// Acceptance check for ClickUp Chat wired into Messenger (CLAUDE.md — v3
// "experimental" Chat API). Verifies: (a) a role without integration:read
// is denied (403) — note every *built-in* role (owner/admin/member/viewer)
// was granted integration:read in migration 0104, so this uses a custom
// role name with no seeded grant row, same as this schema's "custom roles
// get no permissions until an admin grants them" model, (b) sending a
// message requires a connected workspace, (c) the stored token never
// appears in any response shape these functions produce. global.fetch is
// stubbed against the real request/response shapes captured via curl
// against the live API while building this feature (see CLAUDE.md) — same
// reasoning as db/test-clickup-integration-verify.ts.
import { withOrgContext } from "./withOrgContext";
import { requirePermission } from "../lib/api/permissions";
import {
  fetchClickUpChatChannels,
  fetchClickUpChatMessages,
  postClickUpChatMessage,
  withConnectedClickUp,
} from "../lib/api/clickup";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000f1";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000f2";
const NO_GRANT_USER = "00000000-0000-0000-0000-0000000000f3";

const TOKEN = "pk_chat_test_token_do_not_log";
const TEAM_ID = "999888";

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

function stubClickUpChatFetch() {
  const original = global.fetch;
  global.fetch = (async (url: string, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? "GET";

    if (path.endsWith("/user")) {
      return new Response(JSON.stringify({ user: { id: 1, username: "Alice", initials: "AL" } }), { status: 200 });
    }
    if (path.includes("/chat/channels/c1/members")) {
      return new Response(JSON.stringify({ data: [{ id: "1", name: "Alice", initials: "AL" }], next_cursor: "" }), { status: 200 });
    }
    if (path.includes("/chat/channels/c1/messages") && method === "POST") {
      return new Response(JSON.stringify({ id: "m2", content: "hi", date: Date.now(), user_id: "1" }), { status: 200 });
    }
    if (path.includes("/chat/channels/c1/messages")) {
      return new Response(
        JSON.stringify({ data: [{ id: "m1", content: "hello team", date: Date.now(), user_id: "1" }], next_cursor: "" }),
        { status: 200 },
      );
    }
    if (path.includes("/chat/channels") && method === "GET") {
      return new Response(
        JSON.stringify({ data: [{ id: "c1", name: "general", type: "CHANNEL" }], next_cursor: "" }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  return () => {
    global.fetch = original;
  };
}

async function main() {
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();
  const unstub = stubClickUpChatFetch();

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'ClickUp Chat Verify Org', 'clickup-chat-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    // NO_GRANT_USER gets a custom role string with no seeded permissions
    // row at all — this schema's model for "a role the admin hasn't
    // granted anything to yet", not a built-in role (every built-in role
    // has integration:read since migration 0104).
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'admin'), ($3, $2, 'unprovisioned_custom_role')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, NO_GRANT_USER],
    );
    await client.query(
      `insert into integrations (org_id, provider, config, status, connected_at)
       values ($1, 'clickup', $2, 'connected', now())
       on conflict do nothing`,
      [ORG_ID, JSON.stringify({ api_token: TOKEN, team_id: TEAM_ID, team_name: "Chat Verify Workspace" })],
    );
    await client.query("commit");

    // (a) a role with no granted permissions is denied
    await assertForbidden(
      withOrgContext(NO_GRANT_USER, (db) => requirePermission(db, NO_GRANT_USER, ORG_ID, "integration", "read")),
      "a role with no permissions row should be denied integration:read",
    );
    console.log("PASS: requirePermission denies a role with no integration:read grant");

    await withOrgContext(ADMIN_USER, (db) => requirePermission(db, ADMIN_USER, ORG_ID, "integration", "read"));
    console.log("PASS: requirePermission allows admin on integration:read");

    // (b) real channel + message fetch works end to end against the stub
    const channels = await withOrgContext(ADMIN_USER, (db) => withConnectedClickUp(db, ORG_ID, (teamId, token) => fetchClickUpChatChannels(teamId, token)));
    assert(channels.length === 1 && channels[0].name === "general", "channel list should resolve the stubbed channel");
    console.log("PASS: fetchClickUpChatChannels resolves real channel shape");

    const messages = await withOrgContext(ADMIN_USER, (db) =>
      withConnectedClickUp(db, ORG_ID, (teamId, token) => fetchClickUpChatMessages(teamId, "c1", token)),
    );
    assert(messages.length === 1 && messages[0].text === "hello team" && messages[0].authorName === "Alice", "messages should resolve author name via channel members");
    console.log("PASS: fetchClickUpChatMessages resolves author name from channel members");

    // (c) sending requires a connected workspace — disconnect, then confirm
    // the send throws 400 and never reaches the network for a
    // never-connected org.
    const UNCONNECTED_ORG = "00000000-0000-0000-0000-0000000000f4";
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(`insert into organizations (id, name, slug) values ($1, 'Unconnected Org', 'clickup-chat-unconnected') on conflict (id) do nothing`, [UNCONNECTED_ORG]);
    await client.query(`insert into org_memberships (user_id, org_id, role) values ($1, $2, 'admin') on conflict (user_id, org_id) do nothing`, [ADMIN_USER, UNCONNECTED_ORG]);
    await client.query("commit");

    try {
      await withOrgContext(ADMIN_USER, (db) =>
        withConnectedClickUp(db, UNCONNECTED_ORG, (teamId, token) => postClickUpChatMessage(teamId, "c1", token, "should not send")),
      );
      throw new Error("FAIL: expected a 'not connected' error, nothing was thrown");
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 400) throw err;
      assert(/not connected/i.test(err.message), "error should say ClickUp is not connected");
    }
    console.log("PASS: sending a message requires a connected workspace (400, no send attempted)");
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id = $1", [UNCONNECTED_ORG]);
    await client.query("commit");

    // (d) the token never appears in any of these functions' output
    const serialized = JSON.stringify({ channels, messages });
    assert(!serialized.includes(TOKEN), "channels/messages responses must never contain the stored token");
    console.log("PASS: token absent from channels/messages response shapes");

    console.log("\nALL CLICKUP CHAT CHECKS PASSED");
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
