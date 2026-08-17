-- Add optional user_id to people table, linking a PM team member to their
-- Supabase Auth login. Required for task_assigned notifications (resolving
-- a people.id assignee to a real recipient user_id). Nullable because not
-- every team member has a Centr8 OS login.
ALTER TABLE "people" ADD COLUMN "user_id" uuid;
