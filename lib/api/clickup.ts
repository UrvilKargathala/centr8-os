// ClickUp connector (Personal API Token, not OAuth) — every call here runs
// server-side only; the token never reaches the client. See CLAUDE.md for
// why PAT was chosen over OAuth for this integration specifically.
//
// Two API versions in play: v2 for team/space/list/task/comment, v3 for
// Docs (list docs + page content) — ClickUp never brought Docs into v2, and
// v3 only covers Docs, not the rest of this file's endpoints. Same raw
// Authorization header works on both.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { ApiError } from "./helpers";

const BASE_URL = "https://api.clickup.com/api/v2";
const BASE_URL_V3 = "https://api.clickup.com/api/v3";

async function clickupRequest(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: token, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    throw new ApiError(400, "Invalid or expired ClickUp API token");
  }
  if (res.status === 429) {
    throw new ApiError(429, "ClickUp is rate-limiting requests right now — try again in a moment");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(502, `ClickUp API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

function clickupFetch(path: string, token: string, init?: RequestInit) {
  return clickupRequest(`${BASE_URL}${path}`, token, init);
}

function clickupFetchV3(path: string, token: string, init?: RequestInit) {
  return clickupRequest(`${BASE_URL_V3}${path}`, token, init);
}

export async function validateClickUpToken(token: string): Promise<{ teamId: string; teamName: string }> {
  const body = await clickupFetch("/team", token);
  const team = body.teams?.[0];
  if (!team) throw new ApiError(400, "This token has no accessible ClickUp workspace");
  return { teamId: team.id, teamName: team.name };
}

// Pulled out of the connect route so it's directly testable without an
// HTTP round trip (db/test-clickup-integration-verify.ts calls this after
// its own requirePermission check, same split as requireLeaveApproveAccess
// vs. the leave-request route it's used from). Caller is responsible for
// the permission check — an invalid token throws before any write happens.
export async function connectClickUp(db: OrgScopedDb, orgId: string, userId: string, apiToken: string) {
  const { teamId, teamName } = await validateClickUpToken(apiToken);

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "clickup")));

  const values = {
    config: { api_token: apiToken, team_id: teamId, team_name: teamName },
    status: "connected" as const,
    connectedByUserId: userId,
    connectedAt: new Date(),
    lastSyncedAt: new Date(),
    lastError: null,
  };

  if (existing) {
    const [updated] = await db.update(integrations).set(values).where(eq(integrations.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(integrations).values({ orgId, provider: "clickup", ...values }).returning();
  return created;
}

// No list-picker UI yet (spec explicitly defers that) — walks
// space -> folderless lists -> folder lists until it finds any list to
// read from. Recomputed per call rather than cached; fine at this volume.
async function findFirstListId(teamId: string, token: string): Promise<string | null> {
  const spaces = await clickupFetch(`/team/${teamId}/space`, token);
  const space = spaces.spaces?.[0];
  if (!space) return null;

  const folderlessLists = await clickupFetch(`/space/${space.id}/list`, token);
  if (folderlessLists.lists?.[0]) return folderlessLists.lists[0].id;

  const folders = await clickupFetch(`/space/${space.id}/folder`, token);
  for (const folder of folders.folders ?? []) {
    if (folder.lists?.[0]) return folder.lists[0].id;
  }
  return null;
}

export type ClickUpTask = {
  id: string;
  name: string;
  status: string;
  assignees: string[];
  dueDate: string | null;
  url: string;
};

export async function fetchClickUpTasks(teamId: string, token: string): Promise<ClickUpTask[]> {
  const listId = await findFirstListId(teamId, token);
  if (!listId) return [];

  const body = await clickupFetch(`/list/${listId}/task`, token);
  return (body.tasks ?? []).map((t: Record<string, unknown>) => ({
    id: t.id,
    name: t.name,
    status: (t.status as Record<string, unknown>)?.status ?? "unknown",
    assignees: ((t.assignees as Record<string, unknown>[]) ?? []).map((a) => a.username as string),
    dueDate: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
    url: t.url,
  }));
}

export type ClickUpComment = {
  id: string;
  text: string;
  authorName: string;
  postedAt: string;
};

export async function fetchClickUpComments(taskId: string, token: string): Promise<ClickUpComment[]> {
  const body = await clickupFetch(`/task/${taskId}/comment`, token);
  return (body.comments ?? []).map((c: Record<string, unknown>) => ({
    id: c.id,
    text: c.comment_text as string,
    authorName: (c.user as Record<string, unknown>)?.username as string,
    postedAt: new Date(Number(c.date)).toISOString(),
  }));
}

export async function postClickUpComment(taskId: string, token: string, commentText: string): Promise<void> {
  await clickupFetch(`/task/${taskId}/comment`, token, {
    method: "POST",
    body: JSON.stringify({ comment_text: commentText }),
  });
}

export type ClickUpDoc = { id: string; name: string; updatedAt: string };

export async function fetchClickUpDocs(teamId: string, token: string): Promise<ClickUpDoc[]> {
  const body = await clickupFetchV3(`/workspaces/${teamId}/docs`, token);
  return (body.docs ?? []).map((d: Record<string, unknown>) => ({
    id: d.id,
    name: d.name,
    updatedAt: new Date(Number(d.date_updated)).toISOString(),
  }));
}

export type ClickUpDocPage = { id: string; name: string; content: string };

// Read-only, deliberately: ClickUp's public API has no endpoint for
// commenting on a Doc page (confirmed against the live API — a doc id
// passed to the task-comment endpoint 404s, and there is no
// /docs/.../pages/.../comment equivalent anywhere in v2 or v3), unlike
// tasks which fully support fetch+post. Docs are read-only in this UI for
// the same reason — there's nothing to wire a "post" button to.
export async function fetchClickUpDocPages(teamId: string, docId: string, token: string): Promise<ClickUpDocPage[]> {
  const pages = await clickupFetchV3(`/workspaces/${teamId}/docs/${docId}/pages?content_format=text/md`, token);
  return (pages ?? []).map((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name,
    content: (p.content as string) ?? "",
  }));
}

// Chat (v3, ClickUp's own "experimental" designation as of this writing —
// see CLAUDE.md for what that means for maintenance). Every shape below
// was verified against the live API directly (curl), not assumed from
// docs — the real response envelope is `{ data: [...], next_cursor }` for
// list endpoints (not a `channels`/`messages` key), and the send-message
// body key is `content` (not `message`), and the DM-creation body key is
// `member_ids` (not `members`) — all different from a first-glance reading
// of ClickUp's docs.
export type ClickUpChatUser = { id: string; name: string; initials: string };

// GET /user identifies the token's own owner — the only way to know which
// member of a DM's 2-person member list is "the other person" to display,
// since v3 gives no `name` field on DM-type channels themselves.
export async function fetchClickUpChatUser(token: string): Promise<ClickUpChatUser> {
  const body = await clickupFetch("/user", token);
  const u = body.user;
  return { id: String(u.id), name: u.username, initials: u.initials ?? String(u.username).slice(0, 2).toUpperCase() };
}

async function fetchClickUpChannelMembers(teamId: string, channelId: string, token: string): Promise<ClickUpChatUser[]> {
  const body = await clickupFetchV3(`/workspaces/${teamId}/chat/channels/${channelId}/members`, token);
  return (body.data ?? []).map((m: Record<string, unknown>) => ({
    id: String(m.id),
    name: m.name as string,
    initials: (m.initials as string) ?? (m.name as string).slice(0, 2).toUpperCase(),
  }));
}

export type ClickUpChatChannel = { id: string; name: string; type: "channel" | "dm"; memberCount: number };

// Channel list resolution does an extra members-fetch per channel (to name
// DMs and get member counts) — cheap at this workspace's scale (a handful
// of channels), and cached for 60s per spec so opening Messenger
// repeatedly doesn't refetch on every render. In-memory, per-process —
// acceptable for this app's single-instance dev/deploy shape, not correct
// across multiple serverless instances, noted in CLAUDE.md.
const channelCache = new Map<string, { data: ClickUpChatChannel[]; expiresAt: number }>();
const CHANNEL_CACHE_TTL_MS = 60_000;

export async function fetchClickUpChatChannels(teamId: string, token: string): Promise<ClickUpChatChannel[]> {
  const cached = channelCache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const me = await fetchClickUpChatUser(token);
  const body = await clickupFetchV3(`/workspaces/${teamId}/chat/channels?limit=100`, token);
  const raw = (body.data ?? []) as Record<string, unknown>[];

  const resolved = await Promise.all(
    raw.map(async (c) => {
      const id = c.id as string;
      const type: "channel" | "dm" = c.type === "DM" ? "dm" : "channel";
      const members = await fetchClickUpChannelMembers(teamId, id, token).catch(() => [] as ClickUpChatUser[]);
      const name =
        type === "dm" ? (members.find((m) => m.id !== me.id)?.name ?? "Direct Message") : ((c.name as string) ?? "Untitled channel");
      return { id, name, type, memberCount: members.length };
    }),
  );

  channelCache.set(teamId, { data: resolved, expiresAt: Date.now() + CHANNEL_CACHE_TTL_MS });
  return resolved;
}

export type ClickUpChatMessage = { id: string; text: string; authorName: string; authorInitials: string; postedAt: string };

export async function fetchClickUpChatMessages(teamId: string, channelId: string, token: string): Promise<ClickUpChatMessage[]> {
  const [members, body] = await Promise.all([
    fetchClickUpChannelMembers(teamId, channelId, token).catch(() => [] as ClickUpChatUser[]),
    clickupFetchV3(`/workspaces/${teamId}/chat/channels/${channelId}/messages?limit=100`, token),
  ]);
  const membersById = new Map(members.map((m) => [m.id, m]));
  const raw = (body.data ?? []) as Record<string, unknown>[];

  return raw
    .map((m) => {
      const author = membersById.get(String(m.user_id));
      return {
        id: m.id as string,
        text: (m.content as string) ?? "",
        authorName: author?.name ?? "Unknown",
        authorInitials: author?.initials ?? "?",
        postedAt: new Date(Number(m.date)).toISOString(),
      };
    })
    .sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
}

export async function postClickUpChatMessage(teamId: string, channelId: string, token: string, content: string): Promise<void> {
  await clickupFetchV3(`/workspaces/${teamId}/chat/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content, type: "message" }),
  });
  channelCache.delete(teamId); // latest_comment_at changed — don't serve a stale list
}

export async function fetchClickUpWorkspaceMembers(teamId: string, token: string): Promise<ClickUpChatUser[]> {
  const body = await clickupFetch(`/team/${teamId}`, token);
  return ((body.team?.members ?? []) as Record<string, unknown>[]).map((m) => {
    const u = m.user as Record<string, unknown>;
    return { id: String(u.id), name: u.username as string, initials: (u.initials as string) ?? (u.username as string).slice(0, 2).toUpperCase() };
  });
}

export async function createClickUpChatDM(teamId: string, token: string, memberIds: string[]): Promise<{ id: string }> {
  const body = await clickupFetchV3(`/workspaces/${teamId}/chat/channels/direct_message`, token, {
    method: "POST",
    body: JSON.stringify({ member_ids: memberIds }),
  });
  channelCache.delete(teamId);
  return { id: body.data.id };
}

// Every data route (tasks/comments/chat) shares this: look up the org's
// connected ClickUp row, and if the token turns out to be expired/revoked
// mid-call, flip status to 'error' with a message instead of leaving the
// row saying 'connected' while every real request 401s — the UI prompts
// reconnect off status='error', not off a request failing once. A 429 is
// deliberately excluded from that: it's a transient rate-limit, not a
// broken connection, and marking the whole integration 'error' (prompting
// reconnect) over a rate limit would be actively wrong.
export async function withConnectedClickUp<T>(
  db: OrgScopedDb,
  orgId: string,
  fn: (teamId: string, token: string) => Promise<T>,
): Promise<T> {
  const [row] = await db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "clickup")));
  if (!row || row.status !== "connected") throw new ApiError(400, "ClickUp is not connected");

  const config = row.config as { api_token?: string; team_id?: string };
  if (!config.api_token || !config.team_id) throw new ApiError(400, "ClickUp is not connected");

  try {
    const result = await fn(config.team_id, config.api_token);
    await db.update(integrations).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(integrations.id, row.id));
    return result;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) throw err;
    const message = err instanceof ApiError ? err.message : "ClickUp request failed";
    await db.update(integrations).set({ status: "error", lastError: message }).where(eq(integrations.id, row.id));
    throw err;
  }
}
