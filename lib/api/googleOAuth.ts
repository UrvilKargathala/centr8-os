// Shared Google OAuth 2.0 plumbing — extracted from lib/api/gmail.ts (Gmail
// was the first Google connector; Google Meet is the second, reusing the
// exact same GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET Google Cloud OAuth
// client, just a different scope). Nothing here is provider-specific.
//
// Setup: see lib/api/gmail.ts's header comment for the Google Cloud Console
// steps — same project/client, just add each provider's own redirect URI
// (e.g. .../api/integrations/google/callback for Meet) as an additional
// Authorized redirect URI on that one OAuth client.
import { ApiError } from "./helpers";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export function googleAuthorizeUrl(redirectUri: string, orgId: string, scope: string) {
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
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", orgId);
  return url.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, "Google isn't configured — see lib/api/gmail.ts for setup steps.");
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
    throw new ApiError(502, `Google OAuth failed: ${body.error_description ?? body.error ?? "unknown error"}`);
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  const userInfo = (await userInfoRes.json()) as { email?: string };

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresIn: body.expires_in ?? 3600,
    email: userInfo.email ?? null,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, "Google isn't configured — see lib/api/gmail.ts for setup steps.");
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
    throw new ApiError(502, `Google token refresh failed: ${body.error_description ?? body.error ?? "unknown error"}`);
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in ?? 3600 };
}

// Best-effort — a revoked/already-invalid token 400s from Google's own
// revoke endpoint, which is fine, we're clearing our stored copy either way.
export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}
