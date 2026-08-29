// RLS-scoped runtime queries: `db/index.ts`'s neon-http client is stateless
// (one HTTP call per query), so it can't carry the `request.jwt.claim.sub`
// session var RLS policies key off (see 0000_auth_compat.sql). This uses a
// pooled, session-backed connection instead, wraps every call in a
// transaction, and sets that var before handing the caller a drizzle
// instance — so every query inside the callback is scoped to that user's
// orgs by Postgres itself, not just app-layer filtering.
//
// Neon-specific gotcha: the single Neon role this project connects as
// (from both NEON_DIRECT_URL and NEON_POOLED_URL) is the project's owner
// role, and Neon grants BYPASSRLS to owner roles by default — independent
// of, and overriding, the `force row level security` set in
// 0002/0004_force_rls*.sql. So `set role authenticated` (a role we
// deliberately created without BYPASSRLS, see 0000_auth_compat.sql) is not
// optional here; without it every query on this connection silently skips
// RLS regardless of the session var below.
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.NEON_POOLED_URL });

export type OrgScopedDb = NeonDatabase<typeof schema>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withOrgContext<T>(
  userId: string,
  fn: (db: OrgScopedDb) => Promise<T>,
): Promise<T> {
  // userId always comes from a server-verified Supabase JWT `sub` claim
  // (requireUserId()/supabase.auth.getUser()), never raw request input —
  // but we still validate the shape before inlining it below, since a
  // parameterized query can't be combined with the other statements into
  // one round trip (node-postgres doesn't support params on a multi-
  // statement simple-query call). Each round trip to Neon costs real time
  // from a dev machine far from its region, so BEGIN + SET ROLE + set_config
  // — three sequential round trips before — collapse into one here.
  if (!UUID_RE.test(userId)) throw new Error("withOrgContext: userId is not a UUID");

  const client = await pool.connect();
  try {
    await client.query(`begin; set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', true);`);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
