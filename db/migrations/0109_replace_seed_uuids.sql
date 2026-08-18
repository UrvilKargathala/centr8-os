-- Replace placeholder seed UUIDs with real random UUIDs so URLs look clean.
-- Strategy: make FK constraints deferrable, defer them, update everything, restore.

-- Step 1: Make all relevant FK constraints deferrable
ALTER TABLE attendance_records ALTER CONSTRAINT attendance_records_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE candidates ALTER CONSTRAINT candidates_job_posting_id_job_postings_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE client_portal_access ALTER CONSTRAINT client_portal_access_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE compensation_records ALTER CONSTRAINT compensation_records_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE contacts ALTER CONSTRAINT contacts_account_id_accounts_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE deal_stage_history ALTER CONSTRAINT deal_stage_history_deal_id_deals_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE deals ALTER CONSTRAINT deals_account_id_accounts_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE deals ALTER CONSTRAINT deals_contact_id_contacts_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE deals ALTER CONSTRAINT deals_campaign_id_campaigns_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE hr_case_categories ALTER CONSTRAINT hr_case_categories_default_assignee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE hr_case_comments ALTER CONSTRAINT hr_case_comments_author_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE hr_cases ALTER CONSTRAINT hr_cases_assigned_to_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE hr_cases ALTER CONSTRAINT hr_cases_category_id_hr_case_categories_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE hr_cases ALTER CONSTRAINT hr_cases_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE interview_schedules ALTER CONSTRAINT interview_schedules_candidate_id_candidates_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE interview_schedules ALTER CONSTRAINT interview_schedules_interviewer_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE job_postings ALTER CONSTRAINT job_postings_hiring_manager_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE leads ALTER CONSTRAINT leads_converted_account_id_accounts_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE leads ALTER CONSTRAINT leads_campaign_id_campaigns_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE leads ALTER CONSTRAINT leads_converted_contact_id_contacts_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE leave_balances ALTER CONSTRAINT leave_balances_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE leave_requests ALTER CONSTRAINT leave_requests_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE milestones ALTER CONSTRAINT milestones_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE okrs ALTER CONSTRAINT okrs_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE onboarding_workflows ALTER CONSTRAINT onboarding_workflows_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE payslip_records ALTER CONSTRAINT payslip_records_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE performance_reviews ALTER CONSTRAINT performance_reviews_reviewer_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE performance_reviews ALTER CONSTRAINT performance_reviews_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE portfolios ALTER CONSTRAINT portfolios_goal_id_goals_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE project_health_snapshots ALTER CONSTRAINT project_health_snapshots_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE project_members ALTER CONSTRAINT project_members_person_id_people_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE project_members ALTER CONSTRAINT project_members_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE projects ALTER CONSTRAINT projects_portfolio_id_portfolios_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE sprint_capacities ALTER CONSTRAINT sprint_capacities_sprint_id_sprints_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE sprint_plan_proposals ALTER CONSTRAINT sprint_plan_proposals_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE sprints ALTER CONSTRAINT sprints_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE survey_respondents ALTER CONSTRAINT survey_respondents_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE survey_responses ALTER CONSTRAINT survey_responses_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE task_assignees ALTER CONSTRAINT task_assignees_person_id_people_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE task_assignees ALTER CONSTRAINT task_assignees_task_id_tasks_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE task_attachments ALTER CONSTRAINT task_attachments_task_id_tasks_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE task_comments ALTER CONSTRAINT task_comments_task_id_tasks_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE task_dependencies ALTER CONSTRAINT task_dependencies_task_id_tasks_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE task_dependencies ALTER CONSTRAINT task_dependencies_depends_on_task_id_tasks_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE tasks ALTER CONSTRAINT tasks_project_id_projects_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE tasks ALTER CONSTRAINT tasks_sprint_id_sprints_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE training_enrollments ALTER CONSTRAINT training_enrollments_course_id_training_courses_id_fk DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE training_enrollments ALTER CONSTRAINT training_enrollments_employee_id_employees_id_fk DEFERRABLE INITIALLY IMMEDIATE;

-- Also need these for self-referencing / payslip→compensation
ALTER TABLE payslip_records ALTER CONSTRAINT payslip_records_compensation_record_id_compensation_records_id_ DEFERRABLE INITIALLY IMMEDIATE;

-- Step 2: Deferred transaction — update everything
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = 'a0000000-0000-0000-0000-000000000001') THEN
    RAISE NOTICE 'Seed data not found, skipping UUID replacement';
    RETURN;
  END IF;

  CREATE TEMP TABLE _uuid_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL DEFAULT gen_random_uuid());

  INSERT INTO _uuid_map (old_id) VALUES
    ('a0000000-0000-0000-0000-000000000001'),('a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000003'),('a0000000-0000-0000-0000-000000000004'),
    ('a0000000-0000-0000-0000-000000000005'),('a0000000-0000-0000-0000-000000000006'),
    ('a0000000-0000-0000-0000-000000000007'),
    ('b0000000-0000-0000-0000-000000000001'),('b0000000-0000-0000-0000-000000000002'),
    ('b1000000-0000-0000-0000-000000000001'),('b1000000-0000-0000-0000-000000000002'),
    ('c0000000-0000-0000-0000-000000000001'),('c0000000-0000-0000-0000-000000000002'),
    ('c0000000-0000-0000-0000-000000000003'),
    ('c1000000-0000-0000-0000-000000000001'),('c1000000-0000-0000-0000-000000000002'),
    ('c1000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000001'),('d0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000003'),
    ('e0000000-0000-0000-0000-000000000001'),('e0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000003'),('e0000000-0000-0000-0000-000000000004'),
    ('e0000000-0000-0000-0000-000000000005'),('e0000000-0000-0000-0000-000000000006'),
    ('e0000000-0000-0000-0000-000000000007'),('e0000000-0000-0000-0000-000000000008'),
    ('e0000000-0000-0000-0000-000000000009'),('e0000000-0000-0000-0000-000000000010'),
    ('e0000000-0000-0000-0000-000000000011'),('e0000000-0000-0000-0000-000000000012'),
    ('e0000000-0000-0000-0000-000000000013'),('e0000000-0000-0000-0000-000000000014'),
    ('e0000000-0000-0000-0000-000000000015'),
    ('f0000000-0000-0000-0000-000000000001'),('f0000000-0000-0000-0000-000000000002'),
    ('f0000000-0000-0000-0000-000000000003'),('f0000000-0000-0000-0000-000000000004'),
    ('f0000000-0000-0000-0000-000000000005'),('f0000000-0000-0000-0000-000000000006'),
    ('f0000000-0000-0000-0000-000000000007'),('f0000000-0000-0000-0000-000000000008'),
    ('f0000000-0000-0000-0000-000000000009'),
    ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),
    ('10000000-0000-0000-0000-000000000003'),('10000000-0000-0000-0000-000000000004'),
    ('11000000-0000-0000-0000-000000000001'),('11000000-0000-0000-0000-000000000002'),
    ('11000000-0000-0000-0000-000000000003'),('11000000-0000-0000-0000-000000000004'),
    ('11000000-0000-0000-0000-000000000005'),
    ('12000000-0000-0000-0000-000000000003'),('12000000-0000-0000-0000-000000000004'),
    ('12000000-0000-0000-0000-000000000005'),('12000000-0000-0000-0000-000000000006'),
    ('13000000-0000-0000-0000-000000000001'),('13000000-0000-0000-0000-000000000002'),
    ('13000000-0000-0000-0000-000000000003'),('13000000-0000-0000-0000-000000000004'),
    ('13000000-0000-0000-0000-000000000005'),
    ('14000000-0000-0000-0000-000000000001'),('14000000-0000-0000-0000-000000000002'),
    ('14000000-0000-0000-0000-000000000003'),
    ('15000000-0000-0000-0000-000000000001'),('15000000-0000-0000-0000-000000000002'),
    ('15000000-0000-0000-0000-000000000005'),('15000000-0000-0000-0000-000000000006'),
    ('15000000-0000-0000-0000-000000000007'),
    ('16000000-0000-0000-0000-000000000001'),('16000000-0000-0000-0000-000000000002'),
    ('17000000-0000-0000-0000-000000000001'),('17000000-0000-0000-0000-000000000002'),
    ('17000000-0000-0000-0000-000000000003'),('17000000-0000-0000-0000-000000000004'),
    ('17000000-0000-0000-0000-000000000005'),('17000000-0000-0000-0000-000000000006'),
    ('17000000-0000-0000-0000-000000000007'),('17000000-0000-0000-0000-000000000011'),
    ('17000000-0000-0000-0000-000000000012'),('17000000-0000-0000-0000-000000000013'),
    ('17000000-0000-0000-0000-000000000014'),('17000000-0000-0000-0000-000000000015'),
    ('17000000-0000-0000-0000-000000000016'),
    ('18000000-0000-0000-0000-000000000001'),('18000000-0000-0000-0000-000000000002'),
    ('18000000-0000-0000-0000-000000000003'),
    ('19000000-0000-0000-0000-000000000001'),('19000000-0000-0000-0000-000000000002'),
    ('19000000-0000-0000-0000-000000000003'),('19000000-0000-0000-0000-000000000004'),
    ('19000000-0000-0000-0000-000000000005'),('19000000-0000-0000-0000-000000000006'),
    ('19000000-0000-0000-0000-000000000007'),
    ('1a000000-0000-0000-0000-000000000001'),('1a000000-0000-0000-0000-000000000002'),
    ('1a000000-0000-0000-0000-000000000003'),
    ('1b000000-0000-0000-0000-000000000001'),('1b000000-0000-0000-0000-000000000002'),
    ('1b000000-0000-0000-0000-000000000003'),('1b000000-0000-0000-0000-000000000004'),
    ('1c000000-0000-0000-0000-000000000001'),('1c000000-0000-0000-0000-000000000002'),
    ('1c000000-0000-0000-0000-000000000003'),
    ('1d000000-0000-0000-0000-000000000001'),('1d000000-0000-0000-0000-000000000002'),
    ('1d000000-0000-0000-0000-000000000003'),
    ('1e000000-0000-0000-0000-000000000001'),('1e000000-0000-0000-0000-000000000002'),
    ('1f000000-0000-0000-0000-000000000001'),('1f000000-0000-0000-0000-000000000002'),
    ('1f000000-0000-0000-0000-000000000003'),('1f000000-0000-0000-0000-000000000004'),
    ('20000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002'),
    ('20000000-0000-0000-0000-000000000003')
  ON CONFLICT DO NOTHING;

  -- Update all PKs and FK columns — order doesn't matter, constraints are deferred
  UPDATE people SET id = m.new_id FROM _uuid_map m WHERE people.id = m.old_id;
  UPDATE goals SET id = m.new_id FROM _uuid_map m WHERE goals.id = m.old_id;
  UPDATE goals SET owner_id = m.new_id FROM _uuid_map m WHERE goals.owner_id = m.old_id;
  UPDATE portfolios SET id = m.new_id FROM _uuid_map m WHERE portfolios.id = m.old_id;
  UPDATE portfolios SET goal_id = m.new_id FROM _uuid_map m WHERE portfolios.goal_id = m.old_id;
  UPDATE projects SET id = m.new_id FROM _uuid_map m WHERE projects.id = m.old_id;
  UPDATE projects SET portfolio_id = m.new_id FROM _uuid_map m WHERE projects.portfolio_id = m.old_id;
  UPDATE milestones SET id = m.new_id FROM _uuid_map m WHERE milestones.id = m.old_id;
  UPDATE milestones SET project_id = m.new_id FROM _uuid_map m WHERE milestones.project_id = m.old_id;
  UPDATE sprints SET id = m.new_id FROM _uuid_map m WHERE sprints.id = m.old_id;
  UPDATE sprints SET project_id = m.new_id FROM _uuid_map m WHERE sprints.project_id = m.old_id;
  UPDATE tasks SET id = m.new_id FROM _uuid_map m WHERE tasks.id = m.old_id;
  UPDATE tasks SET project_id = m.new_id FROM _uuid_map m WHERE tasks.project_id = m.old_id;
  UPDATE tasks SET sprint_id = m.new_id FROM _uuid_map m WHERE tasks.sprint_id = m.old_id;
  UPDATE tasks SET assignee_id = m.new_id FROM _uuid_map m WHERE tasks.assignee_id = m.old_id;
  UPDATE project_members SET project_id = m.new_id FROM _uuid_map m WHERE project_members.project_id = m.old_id;
  UPDATE project_members SET person_id = m.new_id FROM _uuid_map m WHERE project_members.person_id = m.old_id;
  UPDATE project_health_snapshots SET project_id = m.new_id FROM _uuid_map m WHERE project_health_snapshots.project_id = m.old_id;
  UPDATE task_assignees SET task_id = m.new_id FROM _uuid_map m WHERE task_assignees.task_id = m.old_id;
  UPDATE task_assignees SET person_id = m.new_id FROM _uuid_map m WHERE task_assignees.person_id = m.old_id;
  UPDATE task_comments SET id = m.new_id FROM _uuid_map m WHERE task_comments.id = m.old_id;
  UPDATE task_comments SET task_id = m.new_id FROM _uuid_map m WHERE task_comments.task_id = m.old_id;
  UPDATE task_dependencies SET task_id = m.new_id FROM _uuid_map m WHERE task_dependencies.task_id = m.old_id;
  UPDATE task_dependencies SET depends_on_task_id = m.new_id FROM _uuid_map m WHERE task_dependencies.depends_on_task_id = m.old_id;
  UPDATE task_attachments SET id = m.new_id FROM _uuid_map m WHERE task_attachments.id = m.old_id;
  UPDATE task_attachments SET task_id = m.new_id FROM _uuid_map m WHERE task_attachments.task_id = m.old_id;
  UPDATE sprint_plan_proposals SET project_id = m.new_id FROM _uuid_map m WHERE sprint_plan_proposals.project_id = m.old_id;

  -- HR tables
  UPDATE employees SET id = m.new_id FROM _uuid_map m WHERE employees.id = m.old_id;
  UPDATE employees SET manager_id = m.new_id FROM _uuid_map m WHERE employees.manager_id = m.old_id;
  UPDATE attendance_records SET id = m.new_id FROM _uuid_map m WHERE attendance_records.id = m.old_id;
  UPDATE attendance_records SET employee_id = m.new_id FROM _uuid_map m WHERE attendance_records.employee_id = m.old_id;
  UPDATE leave_requests SET id = m.new_id FROM _uuid_map m WHERE leave_requests.id = m.old_id;
  UPDATE leave_requests SET employee_id = m.new_id FROM _uuid_map m WHERE leave_requests.employee_id = m.old_id;
  UPDATE leave_balances SET employee_id = m.new_id FROM _uuid_map m WHERE leave_balances.employee_id = m.old_id;
  UPDATE compensation_records SET id = m.new_id FROM _uuid_map m WHERE compensation_records.id = m.old_id;
  UPDATE compensation_records SET employee_id = m.new_id FROM _uuid_map m WHERE compensation_records.employee_id = m.old_id;
  UPDATE payslip_records SET employee_id = m.new_id FROM _uuid_map m WHERE payslip_records.employee_id = m.old_id;
  UPDATE payslip_records SET compensation_record_id = m.new_id FROM _uuid_map m WHERE payslip_records.compensation_record_id = m.old_id;
  UPDATE performance_reviews SET employee_id = m.new_id FROM _uuid_map m WHERE performance_reviews.employee_id = m.old_id;
  UPDATE okrs SET employee_id = m.new_id FROM _uuid_map m WHERE okrs.employee_id = m.old_id;
  UPDATE onboarding_workflows SET employee_id = m.new_id FROM _uuid_map m WHERE onboarding_workflows.employee_id = m.old_id;
  UPDATE job_postings SET id = m.new_id FROM _uuid_map m WHERE job_postings.id = m.old_id;
  UPDATE job_postings SET hiring_manager_id = m.new_id FROM _uuid_map m WHERE job_postings.hiring_manager_id = m.old_id;
  UPDATE candidates SET id = m.new_id FROM _uuid_map m WHERE candidates.id = m.old_id;
  UPDATE candidates SET job_posting_id = m.new_id FROM _uuid_map m WHERE candidates.job_posting_id = m.old_id;
  UPDATE interview_schedules SET candidate_id = m.new_id FROM _uuid_map m WHERE interview_schedules.candidate_id = m.old_id;
  UPDATE interview_schedules SET interviewer_id = m.new_id FROM _uuid_map m WHERE interview_schedules.interviewer_id = m.old_id;
  UPDATE training_courses SET id = m.new_id FROM _uuid_map m WHERE training_courses.id = m.old_id;
  UPDATE training_enrollments SET course_id = m.new_id FROM _uuid_map m WHERE training_enrollments.course_id = m.old_id;
  UPDATE training_enrollments SET employee_id = m.new_id FROM _uuid_map m WHERE training_enrollments.employee_id = m.old_id;
  UPDATE hr_case_categories SET id = m.new_id FROM _uuid_map m WHERE hr_case_categories.id = m.old_id;
  UPDATE hr_case_categories SET default_assignee_id = m.new_id FROM _uuid_map m WHERE hr_case_categories.default_assignee_id = m.old_id;
  UPDATE hr_cases SET id = m.new_id FROM _uuid_map m WHERE hr_cases.id = m.old_id;
  UPDATE hr_cases SET employee_id = m.new_id FROM _uuid_map m WHERE hr_cases.employee_id = m.old_id;
  UPDATE hr_cases SET category_id = m.new_id FROM _uuid_map m WHERE hr_cases.category_id = m.old_id;
  UPDATE hr_cases SET assigned_to = m.new_id FROM _uuid_map m WHERE hr_cases.assigned_to = m.old_id;
  UPDATE hr_case_comments SET author_id = m.new_id FROM _uuid_map m WHERE hr_case_comments.author_id = m.old_id;
  UPDATE survey_respondents SET employee_id = m.new_id FROM _uuid_map m WHERE survey_respondents.employee_id = m.old_id;
  UPDATE survey_responses SET employee_id = m.new_id FROM _uuid_map m WHERE survey_responses.employee_id = m.old_id;

  -- CRM tables
  UPDATE accounts SET id = m.new_id FROM _uuid_map m WHERE accounts.id = m.old_id;
  UPDATE accounts SET owner_id = m.new_id FROM _uuid_map m WHERE accounts.owner_id = m.old_id;
  UPDATE contacts SET id = m.new_id FROM _uuid_map m WHERE contacts.id = m.old_id;
  UPDATE contacts SET account_id = m.new_id FROM _uuid_map m WHERE contacts.account_id = m.old_id;
  UPDATE leads SET id = m.new_id FROM _uuid_map m WHERE leads.id = m.old_id;
  UPDATE leads SET owner_id = m.new_id FROM _uuid_map m WHERE leads.owner_id = m.old_id;
  UPDATE deals SET id = m.new_id FROM _uuid_map m WHERE deals.id = m.old_id;
  UPDATE deals SET account_id = m.new_id FROM _uuid_map m WHERE deals.account_id = m.old_id;
  UPDATE deals SET contact_id = m.new_id FROM _uuid_map m WHERE deals.contact_id = m.old_id;
  UPDATE deals SET owner_id = m.new_id FROM _uuid_map m WHERE deals.owner_id = m.old_id;
  UPDATE campaigns SET id = m.new_id FROM _uuid_map m WHERE campaigns.id = m.old_id;
  UPDATE campaigns SET owner_id = m.new_id FROM _uuid_map m WHERE campaigns.owner_id = m.old_id;
  UPDATE activities SET id = m.new_id FROM _uuid_map m WHERE activities.id = m.old_id;
  UPDATE activities SET related_id = m.new_id FROM _uuid_map m WHERE activities.related_id = m.old_id;
  UPDATE activities SET performed_by = m.new_id FROM _uuid_map m WHERE activities.performed_by = m.old_id;
  UPDATE forecast_targets SET id = m.new_id FROM _uuid_map m WHERE forecast_targets.id = m.old_id;
  UPDATE deal_stage_history SET deal_id = m.new_id FROM _uuid_map m WHERE deal_stage_history.deal_id = m.old_id;

  -- Polymorphic link columns
  UPDATE audit_log SET target_id = m.new_id FROM _uuid_map m WHERE audit_log.target_id = m.old_id;
  UPDATE notifications SET link_id = m.new_id FROM _uuid_map m WHERE notifications.link_id = m.old_id;

  DROP TABLE _uuid_map;
END $$;

COMMIT;

-- Step 3: Restore constraints to NOT DEFERRABLE (original state)
ALTER TABLE attendance_records ALTER CONSTRAINT attendance_records_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE candidates ALTER CONSTRAINT candidates_job_posting_id_job_postings_id_fk NOT DEFERRABLE;
ALTER TABLE client_portal_access ALTER CONSTRAINT client_portal_access_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE compensation_records ALTER CONSTRAINT compensation_records_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE contacts ALTER CONSTRAINT contacts_account_id_accounts_id_fk NOT DEFERRABLE;
ALTER TABLE deal_stage_history ALTER CONSTRAINT deal_stage_history_deal_id_deals_id_fk NOT DEFERRABLE;
ALTER TABLE deals ALTER CONSTRAINT deals_account_id_accounts_id_fk NOT DEFERRABLE;
ALTER TABLE deals ALTER CONSTRAINT deals_contact_id_contacts_id_fk NOT DEFERRABLE;
ALTER TABLE deals ALTER CONSTRAINT deals_campaign_id_campaigns_id_fk NOT DEFERRABLE;
ALTER TABLE hr_case_categories ALTER CONSTRAINT hr_case_categories_default_assignee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE hr_case_comments ALTER CONSTRAINT hr_case_comments_author_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE hr_cases ALTER CONSTRAINT hr_cases_assigned_to_employees_id_fk NOT DEFERRABLE;
ALTER TABLE hr_cases ALTER CONSTRAINT hr_cases_category_id_hr_case_categories_id_fk NOT DEFERRABLE;
ALTER TABLE hr_cases ALTER CONSTRAINT hr_cases_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE interview_schedules ALTER CONSTRAINT interview_schedules_candidate_id_candidates_id_fk NOT DEFERRABLE;
ALTER TABLE interview_schedules ALTER CONSTRAINT interview_schedules_interviewer_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE job_postings ALTER CONSTRAINT job_postings_hiring_manager_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE leads ALTER CONSTRAINT leads_converted_account_id_accounts_id_fk NOT DEFERRABLE;
ALTER TABLE leads ALTER CONSTRAINT leads_campaign_id_campaigns_id_fk NOT DEFERRABLE;
ALTER TABLE leads ALTER CONSTRAINT leads_converted_contact_id_contacts_id_fk NOT DEFERRABLE;
ALTER TABLE leave_balances ALTER CONSTRAINT leave_balances_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE leave_requests ALTER CONSTRAINT leave_requests_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE milestones ALTER CONSTRAINT milestones_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE okrs ALTER CONSTRAINT okrs_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE onboarding_workflows ALTER CONSTRAINT onboarding_workflows_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE payslip_records ALTER CONSTRAINT payslip_records_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE payslip_records ALTER CONSTRAINT payslip_records_compensation_record_id_compensation_records_id_ NOT DEFERRABLE;
ALTER TABLE performance_reviews ALTER CONSTRAINT performance_reviews_reviewer_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE performance_reviews ALTER CONSTRAINT performance_reviews_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE portfolios ALTER CONSTRAINT portfolios_goal_id_goals_id_fk NOT DEFERRABLE;
ALTER TABLE project_health_snapshots ALTER CONSTRAINT project_health_snapshots_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE project_members ALTER CONSTRAINT project_members_person_id_people_id_fk NOT DEFERRABLE;
ALTER TABLE project_members ALTER CONSTRAINT project_members_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE projects ALTER CONSTRAINT projects_portfolio_id_portfolios_id_fk NOT DEFERRABLE;
ALTER TABLE sprint_capacities ALTER CONSTRAINT sprint_capacities_sprint_id_sprints_id_fk NOT DEFERRABLE;
ALTER TABLE sprint_plan_proposals ALTER CONSTRAINT sprint_plan_proposals_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE sprints ALTER CONSTRAINT sprints_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE survey_respondents ALTER CONSTRAINT survey_respondents_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE survey_responses ALTER CONSTRAINT survey_responses_employee_id_employees_id_fk NOT DEFERRABLE;
ALTER TABLE task_assignees ALTER CONSTRAINT task_assignees_person_id_people_id_fk NOT DEFERRABLE;
ALTER TABLE task_assignees ALTER CONSTRAINT task_assignees_task_id_tasks_id_fk NOT DEFERRABLE;
ALTER TABLE task_attachments ALTER CONSTRAINT task_attachments_task_id_tasks_id_fk NOT DEFERRABLE;
ALTER TABLE task_comments ALTER CONSTRAINT task_comments_task_id_tasks_id_fk NOT DEFERRABLE;
ALTER TABLE task_dependencies ALTER CONSTRAINT task_dependencies_task_id_tasks_id_fk NOT DEFERRABLE;
ALTER TABLE task_dependencies ALTER CONSTRAINT task_dependencies_depends_on_task_id_tasks_id_fk NOT DEFERRABLE;
ALTER TABLE tasks ALTER CONSTRAINT tasks_project_id_projects_id_fk NOT DEFERRABLE;
ALTER TABLE tasks ALTER CONSTRAINT tasks_sprint_id_sprints_id_fk NOT DEFERRABLE;
ALTER TABLE training_enrollments ALTER CONSTRAINT training_enrollments_course_id_training_courses_id_fk NOT DEFERRABLE;
ALTER TABLE training_enrollments ALTER CONSTRAINT training_enrollments_employee_id_employees_id_fk NOT DEFERRABLE;
