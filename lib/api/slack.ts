// Slack OAuth + Web API helpers (Prompt 7.1 pilot provider).
//
// Setup (real external prerequisite — nothing here works without it):
//   1. Go to https://api.slack.com/apps → "Create New App" → "From scratch".
//   2. Under "OAuth & Permissions", add these Bot Token Scopes:
//        chat:write, chat:write.public
//   3. Under the same page, add a Redirect URL:
//        <your app origin>/api/integrations/slack/callback
//      (e.g. https://centr8-os.vercel.app/api/integrations/slack/callback,
//      or http://localhost:3000/api/integrations/slack/callback for local dev)
//   4. Under "Basic Information" → "App Credentials", copy the Client ID
//      and Client Secret into .env.local (and your Vercel project's env vars):
//        SLACK_CLIENT_ID=...
//        SLACK_CLIENT_SECRET=...
//   5. Install the app to your workspace (or just try "Connect" in Centr8
//      OS — Slack's authorize screen handles installation).
import { ApiError } from "./helpers";

type SlackOAuthResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
};

export async function exchangeSlackCode(code: string, redirectUri: string) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, "Slack isn't configured — see lib/api/slack.ts for setup steps.");
  }

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const body = (await res.json()) as SlackOAuthResponse;
  if (!body.ok) throw new ApiError(502, `Slack OAuth failed: ${body.error ?? "unknown error"}`);

  return {
    accessToken: body.access_token!,
    botUserId: body.bot_user_id ?? null,
    teamId: body.team?.id ?? null,
    teamName: body.team?.name ?? null,
  };
}

export async function sendSlackMessage(accessToken: string, channel: string, text: string) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ channel, text }),
  });
  const body = (await res.json()) as { ok: boolean; error?: string };
  if (!body.ok) throw new ApiError(502, `Slack send failed: ${body.error ?? "unknown error"}`);
}
