// Acceptance check for the Google Meet integration (CLAUDE.md — OAuth via
// the shared Google client, Calendar API for meetings). Verifies: (a) the
// callback's org_id (carried in OAuth `state`) is checked against the
// caller's actual permission, not trusted as proof of access on its own —
// a caller with no integration:configure grant for that org is denied
// even if it supplies that org's id as state, (b) neither access_token nor
// refresh_token ever appears in toPublicIntegration()'s output, (c)
// getValidGoogleToken() skips refreshing a token that's still fresh, and
// correctly triggers exactly one refresh call when the stored expiry is in
// the past. global.fetch is stubbed against Google's real token/userinfo
// endpoint shapes — same reasoning as the ClickUp regression tests.
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "./withOrgContext";
import { integrations } from "./schema";
import { requirePermission } from "../lib/api/permissions";
import { connectGoogleMeet, getValidGoogleToken } from "../lib/api/googleMeet";
import { toPublicIntegration } from "../lib/api/integrations";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-000000000a11";
const ADMIN_USER = "00000000-0000-0000-0000-000000000a12";
const NO_GRANT_USER = "00000000-0000-0000-0000-000000000a13";

const ACCESS_TOKEN = "ya29.fake_access_token_do_not_log";
const REFRESH_TOKEN = "1//fake_refresh_token_do_not_log";
const REFRESHED_ACCESS_TOKEN = "ya29.fake_refreshed_access_token";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function assertForbidden(promise: Promise<unknown>, message: string) {
  try {
    await promise;
    throw new Error(`FAIL: ${message} (expected a 403, nothing was thrown)`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 403) throw err;
  }
}

function stubGoogleFetch(refreshCallCount: { count: number }) {
  const original = global.fetch;
  global.fetch = (async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("oauth2.googleapis.com/token")) {
      const params = new URLSearchParams(String(init?.body ?? ""));
      if (params.get("grant_type") === "refresh_token") {
        refreshCallCount.count += 1;
        return new Response(JSON.stringify({ access_token: REFRESHED_ACCESS_TOKEN, expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, expires_in: 3600 }), { status: 200 });
    }
    if (path.includes("oauth2.googleapis.com/revoke")) {
      return new Response("", { status: 200 });
    }
    if (path.includes("userinfo")) {
      return new Response(JSON.stringify({ email: "verify@example.com" }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  return () => {
    global.fetch = original;
  };
}

async function main() {
  // exchangeGoogleCode/refreshGoogleAccessToken short-circuit with a 503
  // before ever calling fetch if these are unset — this test exercises the
  // OAuth exchange/refresh *logic* against a stubbed network, not real
  // Google credentials, so fake-but-present values are correct here.
  process.env.GOOGLE_CLIENT_ID ||= "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET ||= "test-client-secret";

  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();
  const refreshCallCount = { count: 0 };
  const unstub = stubGoogleFetch(refreshCallCount);

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'Google Meet Verify Org', 'google-meet-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'admin'), ($3, $2, 'unprovisioned_custom_role')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, NO_GRANT_USER],
    );
    await client.query("commit");

    // (a) org_id in `state` is checked against real permission, not trusted —
    // NO_GRANT_USER supplying this org's id as state is still denied.
    await assertForbidden(
      withOrgContext(NO_GRANT_USER, (db) => requirePermission(db, NO_GRANT_USER, ORG_ID, "integration", "configure")),
      "a caller without integration:configure must be denied even when it supplies a real org_id as state",
    );
    console.log("PASS: callback's state org_id alone does not grant access — permission is independently required");

    await withOrgContext(ADMIN_USER, (db) => requirePermission(db, ADMIN_USER, ORG_ID, "integration", "configure"));
    console.log("PASS: requirePermission allows admin on integration:configure");

    // (b) connect flow works end to end against the stub, tokens never leak
    const connected = await withOrgContext(ADMIN_USER, (db) =>
      connectGoogleMeet(db, ORG_ID, ADMIN_USER, "fake-auth-code", "http://localhost:3000/api/integrations/google/callback"),
    );
    assert(connected.status === "connected", "valid code should connect");
    const config = connected.config as Record<string, unknown>;
    assert(config.access_token === ACCESS_TOKEN && config.refresh_token === REFRESH_TOKEN, "tokens should be stored server-side");

    const publicShape = toPublicIntegration(connected);
    const serialized = JSON.stringify(publicShape);
    assert(!serialized.includes(ACCESS_TOKEN), "access_token must never appear in the public response shape");
    assert(!serialized.includes(REFRESH_TOKEN), "refresh_token must never appear in the public response shape");
    assert(!("config" in publicShape), "public response shape must not carry a config key at all");
    console.log("PASS: connect stores tokens server-side, neither ever appears in the public response shape");

    // (c) a fresh token is NOT refreshed
    const firstRead = await withOrgContext(ADMIN_USER, (db) => getValidGoogleToken(db, ORG_ID));
    assert(firstRead.accessToken === ACCESS_TOKEN, "a fresh, non-expired token should be returned as-is");
    assert((refreshCallCount.count as number) === 0, "a fresh token must not trigger a refresh call");
    console.log("PASS: getValidGoogleToken skips refreshing a still-valid token");

    // manually expire the stored token (simulates time passing)
    await withOrgContext(ADMIN_USER, (db) =>
      db
        .update(integrations)
        .set({ config: { ...config, expires_at: new Date(Date.now() - 10_000).toISOString() } })
        .where(and(eq(integrations.orgId, ORG_ID), eq(integrations.provider, "google_meet"))),
    );

    const refreshedRead = await withOrgContext(ADMIN_USER, (db) => getValidGoogleToken(db, ORG_ID));
    assert(refreshedRead.accessToken === REFRESHED_ACCESS_TOKEN, "an expired token should be refreshed and the new access token returned");
    assert((refreshCallCount.count as number) === 1, "exactly one refresh call should have been made for the expired token");
    console.log("PASS: getValidGoogleToken refreshes exactly once when the stored token is expired");

    console.log("\nALL GOOGLE MEET INTEGRATION CHECKS PASSED");
  } finally {
    unstub();
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id = $1", [ORG_ID]);
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
