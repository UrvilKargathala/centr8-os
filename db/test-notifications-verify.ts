// Acceptance check for the Notifications feature (CLAUDE.md — bell +
// dropdown + /notifications). Verifies: (a) createNotification() inserts and
// is immediately queryable, (b) a user can never read or mark-read another
// user's notifications even though insert is allowed cross-user (a manager
// notifying a requester), (c) mark-all-read only ever touches the caller's
// own rows. Same fixture/cleanup pattern as db/test-surveys-batch4-verify.ts.
import { and, eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { notifications } from "./schema";
import { createNotification } from "../lib/notifications/create";

const ORG_ID = "00000000-0000-0000-0000-0000000000d1";
const USER_A = "00000000-0000-0000-0000-0000000000d2";
const USER_B = "00000000-0000-0000-0000-0000000000d3";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'Notifications Verify Org', 'notifications-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'member'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [USER_A, ORG_ID, USER_B],
    );
    await client.query("commit");

    // (a) createNotification() inserts and is immediately queryable — A
    // (e.g. a manager) creates a notification FOR B (e.g. a leave
    // requester). Insert only requires A's own org membership, not B's.
    const created = await withOrgContext(USER_A, (db) =>
      createNotification(db, { orgId: ORG_ID, userId: USER_B, type: "leave_approved", title: "Your leave was approved" }),
    );
    assert(created?.id, "createNotification should return the inserted row");
    console.log("PASS: createNotification() inserts cross-user (actor != recipient)");

    const [immediatelyQueryable] = await withOrgContext(USER_B, (db) =>
      db.select().from(notifications).where(eq(notifications.id, created.id)),
    );
    assert(immediatelyQueryable?.title === "Your leave was approved", "the inserted row must be immediately queryable by its recipient");
    console.log("PASS: inserted notification is immediately queryable");

    // (b) User A cannot read User B's notification — RLS filters it out of
    // A's own SELECT entirely (empty result, not a 403, since select just
    // scopes to A's own rows).
    const [asA] = await withOrgContext(USER_A, (db) => db.select().from(notifications).where(eq(notifications.id, created.id)));
    assert(asA === undefined, "User A must not be able to read User B's notification");
    console.log("PASS: User A's SELECT does not return User B's notification");

    // User A cannot mark User B's notification read either — RLS's
    // notifications_update policy scopes the UPDATE to A's own rows, so
    // this affects 0 rows rather than throwing.
    const markedByA = await withOrgContext(USER_A, (db) =>
      db.update(notifications).set({ isRead: true, readAt: new Date() }).where(eq(notifications.id, created.id)).returning(),
    );
    assert(markedByA.length === 0, "User A must not be able to mark User B's notification read");
    console.log("PASS: User A's UPDATE affects 0 rows on User B's notification");

    const [stillUnread] = await withOrgContext(USER_B, (db) => db.select().from(notifications).where(eq(notifications.id, created.id)));
    assert(stillUnread?.isRead === false, "User B's notification must still be unread after A's failed mark-read attempt");
    console.log("PASS: User B's notification is unaffected by User A's attempt");

    // (c) mark-all-read only affects the caller's own rows, not org-wide.
    // Give both A and B an unread notification, then have A "mark all read".
    await withOrgContext(USER_B, (db) => createNotification(db, { orgId: ORG_ID, userId: USER_A, type: "system", title: "For A" }));
    const bUnreadBefore = await withOrgContext(USER_B, (db) =>
      db.select().from(notifications).where(and(eq(notifications.orgId, ORG_ID), eq(notifications.isRead, false))),
    );
    assert(bUnreadBefore.length >= 1, "User B should still have an unread notification before A's mark-all-read");

    const aMarkedRows = await withOrgContext(USER_A, (db) =>
      db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.orgId, ORG_ID), eq(notifications.isRead, false)))
        .returning({ id: notifications.id }),
    );
    assert(aMarkedRows.length >= 1, "A's mark-all-read should affect at least A's own unread row");

    const [bStillUnread] = await withOrgContext(USER_B, (db) =>
      db.select().from(notifications).where(eq(notifications.id, created.id)),
    );
    assert(bStillUnread?.isRead === false, "User B's notification must remain unread after User A's mark-all-read");
    console.log("PASS: A's mark-all-read does not touch B's notifications (not org-wide)");

    console.log("\nALL NOTIFICATIONS CHECKS PASSED");
  } finally {
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
