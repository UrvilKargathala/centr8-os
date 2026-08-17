// Acceptance check for the ClickUp integration (CLAUDE.md — Personal API
// Token, not OAuth). Verifies: (a) a user without integration:configure
// can't connect/disconnect (403), (b) an invalid token is rejected without
// being saved, (c) a valid token connects and stores config, (d) the
// stored token is never present in any API-shaped response. global.fetch
// is stubbed rather than calling the real ClickUp API — this test must be
// able to run without a live ClickUp account or network access, same
// reasoning any unit test mocks its external HTTP dependency. Same
// fixture/cleanup pattern as db/test-notifications-verify.ts.
import { and, eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { integrations } from "./schema";
import { connectClickUp } from "../lib/api/clickup";
import { requirePermission } from "../lib/api/permissions";
import { toPublicIntegration } from "../lib/api/integrations";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000e1";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000e2";
const MEMBER_USER = "00000000-0000-0000-0000-0000000000e3";

const INVALID_TOKEN = "invalid_pk_token";
const VALID_TOKEN = "pk_valid_test_token_do_not_log";

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

function stubClickUpFetch() {
  const original = global.fetch;
  global.fetch = (async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (String(url).endsWith("/team")) {
      if (auth === VALID_TOKEN) {
        return new Response(JSON.stringify({ teams: [{ id: "999", name: "Test Workspace" }] }), { status: 200 });
      }
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  return () => {
    global.fetch = original;
  };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();
  const unstub = stubClickUpFetch();

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'ClickUp Verify Org', 'clickup-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'admin'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, MEMBER_USER],
    );
    await client.query("commit");

    // (a) member without integration:configure is denied
    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requirePermission(db, MEMBER_USER, ORG_ID, "integration", "configure")),
      "member without integration:configure should be denied connect/disconnect",
    );
    console.log("PASS: requirePermission denies a member on integration:configure");

    await withOrgContext(ADMIN_USER, (db) => requirePermission(db, ADMIN_USER, ORG_ID, "integration", "configure"));
    console.log("PASS: requirePermission allows an admin on integration:configure");

    // (b) invalid token is rejected and nothing is saved
    try {
      await withOrgContext(ADMIN_USER, (db) => connectClickUp(db, ORG_ID, ADMIN_USER, INVALID_TOKEN));
      throw new Error("FAIL: expected an invalid-token error, nothing was thrown");
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 400) throw err;
    }
    const [afterInvalid] = await withOrgContext(ADMIN_USER, (db) =>
      db.select().from(integrations).where(and(eq(integrations.orgId, ORG_ID), eq(integrations.provider, "clickup"))),
    );
    assert(afterInvalid === undefined, "an invalid token must not create/update the integrations row");
    console.log("PASS: invalid token rejected, no row saved");

    // (c) valid token connects and stores config
    const connected = await withOrgContext(ADMIN_USER, (db) => connectClickUp(db, ORG_ID, ADMIN_USER, VALID_TOKEN));
    assert(connected.status === "connected", "valid token should set status='connected'");
    const config = connected.config as Record<string, unknown>;
    assert(config.api_token === VALID_TOKEN, "config.api_token should store the raw token server-side");
    assert(config.team_name === "Test Workspace", "config.team_name should come from ClickUp's /team response");
    console.log("PASS: valid token connects and stores team info");

    // (d) the token never appears in any API-response-shaped JSON
    const publicShape = toPublicIntegration(connected);
    const serialized = JSON.stringify(publicShape);
    assert(!serialized.includes(VALID_TOKEN), "toPublicIntegration()'s output must never contain the raw token");
    assert(!("config" in publicShape), "toPublicIntegration()'s output must not carry a config key at all");
    console.log("PASS: stored token is absent from the public/API-shaped response");

    console.log("\nALL CLICKUP INTEGRATION CHECKS PASSED");
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
