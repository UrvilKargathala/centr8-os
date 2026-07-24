-- Same reasoning as 0002/0004/.../0053_force_rls*.sql.

alter table "task_attachments" force row level security;
