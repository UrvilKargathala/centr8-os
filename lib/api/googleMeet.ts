// Google Meet connector — OAuth via the shared client in lib/api/googleOAuth.ts
// (same Google Cloud project/credentials as Gmail, different scope),
// meetings created/read/cancelled through the Calendar API v3 (a Meet link
// is just a calendar event with conferenceData attached, not a separate
// "meetings" resource — there is no standalone Google Meet API for this).
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { ApiError } from "./helpers";
import { exchangeGoogleCode, refreshGoogleAccessToken, revokeGoogleToken } from "./googleOAuth";

type GoogleConfig = { access_token?: string; refresh_token?: string; expires_at?: string; team_name?: string; calendar_id?: string };

export async function connectGoogleMeet(db: OrgScopedDb, orgId: string, userId: string, code: string, redirectUri: string) {
  const { accessToken, refreshToken, expiresIn, email } = await exchangeGoogleCode(code, redirectUri);
  if (!refreshToken) {
    throw new ApiError(
      400,
      "Google didn't return a refresh token — disconnect any prior access at myaccount.google.com/permissions and try again.",
    );
  }

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "google_meet")));

  const values = {
    config: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      team_name: email, // reused generically by toPublicIntegration()'s accountLabel, same as gmail/clickup
      calendar_id: "primary",
    },
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
  const [created] = await db.insert(integrations).values({ orgId, provider: "google_meet", ...values }).returning();
  return created;
}

// Expiry-aware, unlike Gmail's "always refresh before every send" (a send
// is rare; Calendar reads happen on every Video-tab visit, so refreshing
// unconditionally there would mean 2 Google round trips per action instead
// of 1). 60s buffer so a token that's about to expire mid-request still
// gets refreshed proactively rather than racing Google's own clock.
// Exported (not module-private) specifically so
// db/test-google-meet-integration-verify.ts can call it directly with a
// manually-expired test row, rather than only exercising it indirectly
// through withGoogleCalendar.
export async function getValidGoogleToken(
  db: OrgScopedDb,
  orgId: string,
  opts?: { forceRefresh?: boolean },
): Promise<{ accessToken: string; calendarId: string }> {
  const [row] = await db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "google_meet")));
  if (!row || row.status !== "connected") throw new ApiError(400, "Google Meet is not connected");

  const config = row.config as GoogleConfig;
  if (!config.access_token || !config.refresh_token) throw new ApiError(400, "Google Meet is not connected");

  const expiresAtMs = config.expires_at ? new Date(config.expires_at).getTime() : 0;
  const needsRefresh = opts?.forceRefresh || !expiresAtMs || expiresAtMs - 60_000 < Date.now();
  if (!needsRefresh) return { accessToken: config.access_token, calendarId: config.calendar_id ?? "primary" };

  try {
    const { accessToken, expiresIn } = await refreshGoogleAccessToken(config.refresh_token);
    const nextConfig: GoogleConfig = { ...config, access_token: accessToken, expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() };
    await db.update(integrations).set({ config: nextConfig, lastSyncedAt: new Date(), lastError: null }).where(eq(integrations.id, row.id));
    return { accessToken, calendarId: config.calendar_id ?? "primary" };
  } catch (err) {
    // refresh_token itself is invalid/revoked (e.g. user pulled access from
    // myaccount.google.com) — no amount of retrying fixes this, only
    // reconnecting does, so this is the one case that always marks 'error'.
    const message = err instanceof ApiError ? err.message : "Google token refresh failed";
    await db.update(integrations).set({ status: "error", lastError: message }).where(eq(integrations.id, row.id));
    throw new ApiError(400, "Google Meet connection expired — please reconnect in Integrations.");
  }
}

// Every meetings route shares this: resolve a valid token, run the call,
// and if Google still says 401 despite our stored expiry looking fine
// (clock drift, or the token was invalidated out-of-band), force one
// refresh and retry exactly once before surfacing an error — never a raw
// 401 to the user, per spec.
export async function withGoogleCalendar<T>(
  db: OrgScopedDb,
  orgId: string,
  fn: (accessToken: string, calendarId: string) => Promise<T>,
): Promise<T> {
  const { accessToken, calendarId } = await getValidGoogleToken(db, orgId);
  try {
    return await fn(accessToken, calendarId);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const retried = await getValidGoogleToken(db, orgId, { forceRefresh: true });
    try {
      return await fn(retried.accessToken, retried.calendarId);
    } catch (err2) {
      const message = err2 instanceof ApiError ? err2.message : "Google Calendar request failed";
      await db
        .update(integrations)
        .set({ status: "error", lastError: message })
        .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "google_meet")));
      throw err2;
    }
  }
}

export async function disconnectGoogleMeet(db: OrgScopedDb, orgId: string) {
  const [row] = await db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "google_meet")));
  if (!row) return;
  const config = row.config as GoogleConfig;
  if (config.access_token) await revokeGoogleToken(config.access_token);
  await db
    .update(integrations)
    .set({ status: "disconnected", config: {}, connectedByUserId: null, connectedAt: null, lastError: null })
    .where(eq(integrations.id, row.id));
}

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

async function calendarFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status === 401 ? 401 : 502, `Google Calendar API error (${res.status}): ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export type GoogleMeeting = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetUrl: string | null;
  attendees: string[];
  htmlLink: string;
};

function mapEvent(e: Record<string, unknown>): GoogleMeeting {
  const conferenceData = e.conferenceData as { entryPoints?: { entryPointType: string; uri: string }[] } | undefined;
  const meetUrl = conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? (e.hangoutLink as string) ?? null;
  const start = e.start as { dateTime?: string; date?: string };
  const end = e.end as { dateTime?: string; date?: string };
  return {
    id: e.id as string,
    title: (e.summary as string) ?? "Untitled meeting",
    startTime: start.dateTime ?? start.date ?? "",
    endTime: end.dateTime ?? end.date ?? "",
    meetUrl,
    attendees: ((e.attendees as { email: string }[]) ?? []).map((a) => a.email),
    htmlLink: e.htmlLink as string,
  };
}

export async function createGoogleMeeting(
  accessToken: string,
  calendarId: string,
  params: { title: string; startTime: string; endTime: string; attendeeEmails: string[]; description?: string },
): Promise<GoogleMeeting> {
  const body = {
    summary: params.title,
    description: params.description || undefined,
    start: { dateTime: params.startTime },
    end: { dateTime: params.endTime },
    attendees: params.attendeeEmails.map((email) => ({ email })),
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  };
  const event = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapEvent(event as Record<string, unknown>);
}

export async function listGoogleMeetings(
  accessToken: string,
  calendarId: string,
  params: { timeMin: string; timeMax: string },
): Promise<GoogleMeeting[]> {
  const q = new URLSearchParams({ timeMin: params.timeMin, timeMax: params.timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  const body = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
  return ((body as { items?: Record<string, unknown>[] }).items ?? []).filter((e) => e.conferenceData).map(mapEvent);
}

export async function cancelGoogleMeeting(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: "DELETE" });
}
