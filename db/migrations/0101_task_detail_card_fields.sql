-- Task Detail card redesign (Calendar view task click): adds fields the
-- new card surfaces that tasks didn't carry before — category, a start/end
-- time pair alongside the existing due_date, and a real multi-assignee
-- join table (task_assignees) additive alongside tasks.assignee_id, which
-- every other task view keeps reading as-is.

ALTER TABLE "tasks" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "end_time" time;--> statement-breakpoint

CREATE TABLE "task_assignees" (
	"task_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_assignees_task_id_person_id_pk" PRIMARY KEY("task_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "task_assignees_isolation" ON "task_assignees" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));
