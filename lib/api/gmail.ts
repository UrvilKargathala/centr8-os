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
import { ApiError } from "./helpers";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export function gmailAuthorizeUrl(redirectUri: string, orgId: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  // Forces Google to re-issue a refresh_token even if this org connected
  // before — without this, a reconnect after disconnect silently omits it.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
  );
  url.searchParams.set("state", orgId);
  return url.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, "Gmail isn't configured — see lib/api/gmail.ts for setup steps.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !body.access_token) {
    throw new ApiError(502, `Gmail OAuth failed: ${body.error_description ?? body.error ?? "unknown error"}`);
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  const userInfo = (await userInfoRes.json()) as { email?: string };

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    email: userInfo.email ?? null,
  };
}

// Access tokens expire in ~1hr — always refresh before sending rather than
// tracking expiry separately, same reasoning as not caching Slack's (which
// doesn't expire, hence no equivalent there).
async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, "Gmail isn't configured — see lib/api/gmail.ts for setup steps.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !body.access_token) {
    throw new ApiError(502, `Gmail token refresh failed: ${body.error_description ?? body.error ?? "unknown error"}`);
  }
  return body.access_token;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
