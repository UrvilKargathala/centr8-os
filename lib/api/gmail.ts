// Gmail OAuth + API helpers (Prompt 7.1 second connector, mirrors slack.ts).
//
// Setup (real external prerequisite — nothing here works without it):
//   1. Go to https://console.cloud.google.com → create/select a project.
//   2. "APIs & Services" → "Library" → enable the "Gmail API".
//   3. "APIs & Services" → "OAuth consent screen" → configure it (External,
//      testing mode is fine to start — see the note below on verification).
//   4. "APIs & Services" → "Credentials" → "Create Credentials" →
//      "OAuth client ID" → type "Web application".
//   5. Add an Authorized redirect URI:
//        <your app origin>/api/integrations/gmail/callback
//      (e.g. https://centr8-os-amber.vercel.app/api/integrations/gmail/callback,
//      or http://localhost:3000/api/integrations/gmail/callback for local dev)
//   6. Copy the Client ID and Client Secret into .env.local (and Vercel):
//        GOOGLE_CLIENT_ID=...
//        GOOGLE_CLIENT_SECRET=...
//
// Note on verification: the gmail.send scope is a "sensitive" scope. While
// the OAuth consent screen is in "Testing" mode, only test users you
// explicitly add in the Google Cloud project can authorize it — anyone else
// gets blocked at Google's consent screen. Going to "Production" for
// gmail.send requires Google's app verification review (can take days).
// This is a real external constraint, not something fixable in code.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { ApiError } from "./helpers";
import { exchangeGoogleCode, googleAuthorizeUrl, refreshGoogleAccessToken } from "./googleOAuth";

export function gmailAuthorizeUrl(redirectUri: string, orgId: string) {
  return googleAuthorizeUrl(
    redirectUri,
    orgId,
    "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
  );
}

export { exchangeGoogleCode };

// Access tokens expire in ~1hr — always refresh before sending rather than
// tracking expiry separately, same reasoning as not caching Slack's (which
// doesn't expire, hence no equivalent there). Google Meet's connector needs
// tighter control (calendar reads happen far more often than Gmail sends),
// so it tracks expiry and only refreshes when needed — see
// lib/api/googleMeet.ts's getValidGoogleToken().
async function refreshAccessToken(refreshToken: string) {
  const { accessToken } = await refreshGoogleAccessToken(refreshToken);
  return accessToken;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- Gmail read helpers (gmail.readonly scope) ----------

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(accessToken: string, path: string) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status === 401 ? 401 : 502, `Gmail API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string[];
  snippet: string;
  body: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
};

function decodeBase64Url(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function headerValue(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2] };
  return { name: raw, email: raw };
}

function extractBody(payload: Record<string, unknown>): string {
  const body = payload.body as { data?: string; size?: number } | undefined;
  if (body?.data) return decodeBase64Url(body.data);
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (!parts) return "";
  const textPart = parts.find((p) => (p.mimeType as string) === "text/plain");
  if (textPart) return extractBody(textPart);
  const htmlPart = parts.find((p) => (p.mimeType as string) === "text/html");
  if (htmlPart) return extractBody(htmlPart);
  for (const p of parts) {
    const nested = extractBody(p);
    if (nested) return nested;
  }
  return "";
}

function mapMessage(raw: Record<string, unknown>): GmailMessage {
  const payload = raw.payload as Record<string, unknown>;
  const headers = (payload.headers as { name: string; value: string }[]) ?? [];
  const labels = (raw.labelIds as string[]) ?? [];
  const from = parseFrom(headerValue(headers, "From"));
  const toParts = headerValue(headers, "To").split(",").map((s) => s.trim()).filter(Boolean);
  const parts = payload.parts as { filename?: string }[] | undefined;
  const hasAttachments = (parts ?? []).some((p) => p.filename && p.filename.length > 0);

  return {
    id: raw.id as string,
    threadId: raw.threadId as string,
    subject: headerValue(headers, "Subject") || "(no subject)",
    from: from.name,
    fromEmail: from.email,
    to: toParts,
    snippet: (raw.snippet as string) ?? "",
    body: extractBody(payload),
    date: headerValue(headers, "Date"),
    isUnread: labels.includes("UNREAD"),
    isStarred: labels.includes("STARRED"),
    hasAttachments,
    labels,
  };
}

export async function listGmailMessages(
  accessToken: string,
  opts: { q?: string; labelIds?: string[]; maxResults?: number; pageToken?: string } = {},
): Promise<{ messages: GmailMessage[]; nextPageToken: string | null }> {
  const params = new URLSearchParams();
  params.set("maxResults", String(opts.maxResults ?? 20));
  if (opts.q) params.set("q", opts.q);
  if (opts.labelIds?.length) params.set("labelIds", opts.labelIds.join(","));
  if (opts.pageToken) params.set("pageToken", opts.pageToken);

  const list = (await gmailFetch(accessToken, `/messages?${params}`)) as { messages?: { id: string }[]; nextPageToken?: string };
  if (!list.messages?.length) return { messages: [], nextPageToken: null };

  const detailed = await Promise.all(
    list.messages.map((m) => gmailFetch(accessToken, `/messages/${m.id}?format=full`) as Promise<Record<string, unknown>>),
  );
  return { messages: detailed.map(mapMessage), nextPageToken: list.nextPageToken ?? null };
}

export async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const raw = (await gmailFetch(accessToken, `/messages/${messageId}?format=full`)) as Record<string, unknown>;
  return mapMessage(raw);
}

export async function getGmailThread(accessToken: string, threadId: string): Promise<GmailMessage[]> {
  const raw = (await gmailFetch(accessToken, `/threads/${threadId}?format=full`)) as { messages: Record<string, unknown>[] };
  return (raw.messages ?? []).map(mapMessage);
}

type GmailConfig = { access_token?: string; refresh_token?: string; team_name?: string };

export async function withConnectedGmail<T>(
  db: OrgScopedDb,
  orgId: string,
  fn: (accessToken: string, connectedEmail: string) => Promise<T>,
): Promise<T> {
  const [row] = await db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "gmail")));
  if (!row || row.status !== "connected") throw new ApiError(400, "Gmail isn't connected — connect it under Administration → Integrations.");
  const config = row.config as GmailConfig;
  if (!config.refresh_token) throw new ApiError(500, "Gmail integration is missing its refresh token");

  const accessToken = await refreshAccessToken(config.refresh_token);
  try {
    return await fn(accessToken, config.team_name ?? "");
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const retried = await refreshAccessToken(config.refresh_token);
    return fn(retried, config.team_name ?? "");
  }
}

// ---------- Gmail send (gmail.send scope) ----------

export async function sendGmailMessage(
  refreshToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  body: string,
) {
  const accessToken = await refreshAccessToken(refreshToken);

  const mime = [`From: ${fromEmail}`, `To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join(
    "\r\n",
  );

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(502, `Gmail send failed: ${errBody?.error?.message ?? res.statusText}`);
  }
}
