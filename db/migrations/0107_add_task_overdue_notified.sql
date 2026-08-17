-- Hand-written migration (same reason as 0102+: drizzle-kit generate is
-- unsafe on this repo's diverged snapshot chain).
-- Adds overdueNotifiedAt to tasks for task_overdue notification dedup.
ALTER TABLE tasks ADD COLUMN overdue_notified_at timestamptz;
