-- Optional bridge between the two unlinked person directories (see
-- CLAUDE.md's "employees vs people dual-directory" TODO). Deliberately NOT
-- a merge — people (PM: capacity/skills) and employees (HR: employment
-- record) stay separate tables with separate shapes, since they serve
-- genuinely different flows. This just adds a nullable pointer from a
-- people row to its employees counterpart, when one is known to exist.
--
-- Backfilled by matching user_id: both tables already have a nullable
-- user_id pointing at the same Supabase Auth login (people.user_id added
-- in 0106), so a person and an employee sharing the same real login within
-- the same org are almost certainly the same human — the one link path
-- that doesn't require guessing on name/email similarity.
ALTER TABLE "people" ADD COLUMN "linked_employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL;

UPDATE "people" p
SET "linked_employee_id" = e."id"
FROM "employees" e
WHERE p."user_id" IS NOT NULL
  AND p."user_id" = e."user_id"
  AND p."org_id" = e."org_id"
  AND p."linked_employee_id" IS NULL;
