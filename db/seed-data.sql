-- Seed realistic data across all pillars for org 00000000-0000-0000-0000-000000000001.
-- Runs as service_role (bypasses RLS). Idempotent via ON CONFLICT DO NOTHING on PKs.

-- ============================================================
-- FIXED IDs (for FK references within this script)
-- ============================================================
-- People (PM Team Directory)
-- p1..p6
-- Projects: proj1..proj3
-- Sprints: spr1..spr3
-- Employees: emp1..emp8
-- Accounts: acc1..acc4
-- Contacts: con1..con5
-- Leads: lead1..lead6
-- Deals: deal1..deal5
-- Campaigns: camp1..camp3

DO $$ BEGIN

-- ============================================================
-- 1. PEOPLE (PM Team Directory)
-- ============================================================
INSERT INTO people (id, org_id, full_name, work_email, job_title, department, available_hours_per_week, skills)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Urvil Kargathala', 'urvil@centr8.io', 'Founder & CEO', 'Engineering', 40, '["Product Strategy","AI/ML","Full-Stack Development"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Arjun Mehta', 'arjun@centr8.io', 'Lead Engineer', 'Engineering', 40, '["React","Node.js","PostgreSQL"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Priya Sharma', 'priya@centr8.io', 'Product Designer', 'Design', 40, '["Figma","UI/UX","Design Systems"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Rohan Patel', 'rohan@centr8.io', 'Backend Engineer', 'Engineering', 40, '["Python","APIs","DevOps"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Ananya Desai', 'ananya@centr8.io', 'Marketing Manager', 'Marketing', 40, '["Content Strategy","SEO","Analytics"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Vikram Singh', 'vikram@centr8.io', 'Sales Lead', 'Sales', 40, '["B2B Sales","CRM","Negotiation"]'::jsonb),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Milind Bhalala', 'milind@centr8.io', 'Co-Founder & CTO', 'Engineering', 40, '["Architecture","Cloud Infrastructure","AI/ML"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. GOALS & PORTFOLIOS
-- ============================================================
INSERT INTO goals (id, org_id, title, description, owner_id)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Launch Centr8 OS MVP', 'Ship the minimum viable product to first 10 design partners by Q3 2026', null),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Acquire 50 Paying Customers', 'Convert design partners and inbound leads into paying customers by Q4 2026', null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO portfolios (id, org_id, goal_id, name)
VALUES
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Product Development'),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Go-to-Market')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. PROJECTS
-- ============================================================
INSERT INTO projects (id, org_id, portfolio_id, name, status, start_date, end_date, budget_allocated, budget_spent)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Platform Core Build', 'active', '2026-06-01', '2026-09-30', 500000, 180000),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'AI Agent Framework', 'active', '2026-07-01', '2026-10-31', 300000, 45000),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'Website & Marketing Launch', 'planning', '2026-08-01', '2026-09-15', 150000, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. MILESTONES
-- ============================================================
INSERT INTO milestones (id, org_id, project_id, name, due_date)
VALUES
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Alpha Release', '2026-08-15'),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Beta Launch', '2026-09-15'),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Planner Agent v1', '2026-08-30')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. SPRINTS
-- ============================================================
INSERT INTO sprints (id, org_id, project_id, name, start_date, end_date, status)
VALUES
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sprint 1 — Foundation', '2026-07-21', '2026-08-03', 'completed'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sprint 2 — Dashboard & Auth', '2026-08-04', '2026-08-17', 'active'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Sprint 1 — Agent Architecture', '2026-08-04', '2026-08-17', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. TASKS
-- ============================================================
INSERT INTO tasks (id, org_id, project_id, sprint_id, title, description, status, priority, assignee_id, estimate, due_date, category)
VALUES
  -- Sprint 1 (completed) tasks
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Set up Neon Postgres + Drizzle schema', 'Initialize database, RLS policies, and migration pipeline', 'done', 'high', 'a0000000-0000-0000-0000-000000000002', 8, '2026-07-25', 'Backend'),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Supabase Auth + RBAC integration', 'Wire up auth flow, role-based permissions, org isolation', 'done', 'high', 'a0000000-0000-0000-0000-000000000004', 13, '2026-07-28', 'Backend'),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Design system tokens + component library', 'Set up Tailwind tokens, base components (Card, Badge, Avatar, etc.)', 'done', 'medium', 'a0000000-0000-0000-0000-000000000003', 8, '2026-07-30', 'Design'),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'CI/CD pipeline — Vercel + GitHub Actions', null, 'done', 'medium', 'a0000000-0000-0000-0000-000000000004', 5, '2026-08-01', 'DevOps'),

  -- Sprint 2 (active) tasks
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Global dashboard — cross-pillar stats', 'Build the /dashboard page with PM, HR, CRM, Comms cards', 'in_progress', 'high', 'a0000000-0000-0000-0000-000000000002', 13, '2026-08-10', 'Frontend'),
  ('e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Task detail card redesign', 'Match the reference mockup — labeled meta rows, multi-assignee, file chips', 'done', 'medium', 'a0000000-0000-0000-0000-000000000003', 8, '2026-08-08', 'Frontend'),
  ('e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'CRM Batch 3 — Forecasts & Campaigns', 'Build Sales Forecasts (computed) and Campaigns (with ROI)', 'in_review', 'high', 'a0000000-0000-0000-0000-000000000004', 21, '2026-08-14', 'Backend'),
  ('e0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Leave management self-service', 'Restructure leave types/policies/balances, employee-facing UI', 'todo', 'medium', 'a0000000-0000-0000-0000-000000000002', 13, '2026-08-15', 'Backend'),
  ('e0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Integration connect modals — Slack, Gmail, Google Meet', 'OAuth-consent-style connect flow, brand icons, permission scopes', 'in_progress', 'low', 'a0000000-0000-0000-0000-000000000003', 5, '2026-08-12', 'Frontend'),

  -- AI Agent project sprint
  ('e0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Planner agent — NL to structured plan', 'Gemini prompt chain: parse NL input, produce goals/milestones/tasks', 'in_progress', 'urgent', 'a0000000-0000-0000-0000-000000000001', 21, '2026-08-12', 'AI'),
  ('e0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Monitor agent — health signals & risk', 'Detect overdue tasks, scope creep, delivery risk signals', 'todo', 'high', 'a0000000-0000-0000-0000-000000000004', 13, '2026-08-15', 'AI'),
  ('e0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Agent job queue — Postgres-backed worker', 'SELECT FOR UPDATE SKIP LOCKED queue, Railway worker runner', 'in_progress', 'high', 'a0000000-0000-0000-0000-000000000002', 8, '2026-08-10', 'Backend'),

  -- Backlog tasks (no sprint)
  ('e0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', null, 'Landing page design', 'Design the centr8.io marketing site', 'backlog', 'medium', 'a0000000-0000-0000-0000-000000000003', 13, '2026-08-20', 'Design'),
  ('e0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', null, 'Write launch blog post', null, 'backlog', 'low', 'a0000000-0000-0000-0000-000000000005', 5, '2026-08-25', 'Marketing'),
  ('e0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', null, 'SEO audit & meta tags', null, 'backlog', 'low', 'a0000000-0000-0000-0000-000000000005', 3, '2026-08-28', 'Marketing')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. EMPLOYEES (HR)
-- ============================================================
INSERT INTO employees (id, org_id, full_name, job_title, department_id, team_id, employment_status, start_date, email, phone, employment_type, employee_code)
VALUES
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Urvil Kargathala', 'Founder & CEO', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'active', '2026-01-01', 'urvil@centr8.io', '+91 98765 43210', 'full_time', 'C8-001'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Arjun Mehta', 'Lead Engineer', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'active', '2026-03-15', 'arjun@centr8.io', '+91 98765 43211', 'full_time', 'C8-002'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Priya Sharma', 'Product Designer', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'active', '2026-04-01', 'priya@centr8.io', '+91 98765 43212', 'full_time', 'C8-003'),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Rohan Patel', 'Backend Engineer', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'active', '2026-04-15', 'rohan@centr8.io', '+91 98765 43213', 'full_time', 'C8-004'),
  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Ananya Desai', 'Marketing Manager', '00000000-0000-0000-0000-0000000000d1', null, 'active', '2026-05-01', 'ananya@centr8.io', '+91 98765 43214', 'full_time', 'C8-005'),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Vikram Singh', 'Sales Lead', '00000000-0000-0000-0000-0000000000d1', null, 'active', '2026-05-15', 'vikram@centr8.io', '+91 98765 43215', 'full_time', 'C8-006'),
  ('f0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Neha Gupta', 'QA Engineer', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'active', '2026-06-01', 'neha@centr8.io', '+91 98765 43216', 'full_time', 'C8-007'),
  ('f0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Karan Joshi', 'DevOps Engineer', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'onboarding', '2026-08-01', 'karan@centr8.io', '+91 98765 43217', 'full_time', 'C8-008'),
  ('f0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Milind Bhalala', 'Co-Founder & CTO', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'active', '2026-01-01', 'milind@centr8.io', '+91 98765 43220', 'full_time', 'C8-009')
ON CONFLICT (id) DO NOTHING;

-- Set manager relationships
UPDATE employees SET manager_id = 'f0000000-0000-0000-0000-000000000001' WHERE id IN (
  'f0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000005',
  'f0000000-0000-0000-0000-000000000006'
) AND manager_id IS NULL;
UPDATE employees SET manager_id = 'f0000000-0000-0000-0000-000000000002' WHERE id = 'f0000000-0000-0000-0000-000000000004' AND manager_id IS NULL;
UPDATE employees SET manager_id = 'f0000000-0000-0000-0000-000000000009' WHERE id IN (
  'f0000000-0000-0000-0000-000000000007',
  'f0000000-0000-0000-0000-000000000008'
) AND manager_id IS NULL;

-- ============================================================
-- 8. CRM — ACCOUNTS
-- ============================================================
INSERT INTO accounts (id, org_id, name, industry, website, phone, email, city, state, country, type, status, annual_revenue, employee_count_range, owner_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TechNova Solutions', 'Technology', 'https://technova.in', '+91 22 4000 1234', 'info@technova.in', 'Mumbai', 'Maharashtra', 'India', 'customer', 'active', 25000000, '50-200', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'GreenLeaf Organics', 'Agriculture', 'https://greenleaf.co.in', '+91 80 2500 5678', 'contact@greenleaf.co.in', 'Bangalore', 'Karnataka', 'India', 'customer', 'active', 8000000, '10-50', 'a0000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Meridian Consulting', 'Professional Services', 'https://meridian.biz', '+91 11 3500 9012', 'hello@meridian.biz', 'New Delhi', 'Delhi', 'India', 'prospect', 'active', 50000000, '200-500', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'CloudFirst India', 'Cloud Infrastructure', 'https://cloudfirst.in', '+91 40 6700 3456', 'sales@cloudfirst.in', 'Hyderabad', 'Telangana', 'India', 'partner', 'active', 120000000, '500-1000', 'a0000000-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. CRM — CONTACTS
-- ============================================================
INSERT INTO contacts (id, org_id, account_id, name, email, phone, title, department, is_primary_contact, is_decision_maker, city, country)
VALUES
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Rajesh Kumar', 'rajesh@technova.in', '+91 98100 12345', 'CTO', 'Technology', true, true, 'Mumbai', 'India'),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sneha Iyer', 'sneha@technova.in', '+91 98100 12346', 'VP Engineering', 'Engineering', false, false, 'Mumbai', 'India'),
  ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Amit Verma', 'amit@greenleaf.co.in', '+91 99000 56789', 'Operations Head', 'Operations', true, true, 'Bangalore', 'India'),
  ('11000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Kavita Reddy', 'kavita@meridian.biz', '+91 98200 78901', 'Managing Director', 'Management', true, true, 'New Delhi', 'India'),
  ('11000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Sanjay Nair', 'sanjay@cloudfirst.in', '+91 98300 23456', 'Partnerships Lead', 'Business Development', true, false, 'Hyderabad', 'India')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. CRM — LEADS
-- ============================================================
INSERT INTO leads (id, org_id, name, company, email, phone, job_title, source, status, score, owner_id)
VALUES
  ('12000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Aditya Rao', 'UrbanNest Properties', 'aditya@urbannest.in', '+91 98400 33333', 'COO', 'linkedin', 'new', 45, 'a0000000-0000-0000-0000-000000000001'),
  ('12000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Ishita Banerjee', 'MediCore Health', 'ishita@medicore.in', '+91 98400 44444', 'IT Director', 'website', 'qualified', 78, 'a0000000-0000-0000-0000-000000000001'),
  ('12000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Nikhil Agarwal', 'SwiftLogix', 'nikhil@swiftlogix.com', '+91 98400 55555', 'VP Operations', 'cold_outreach', 'contacted', 55, 'a0000000-0000-0000-0000-000000000007'),
  ('12000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Pooja Nair', 'BrightMinds Academy', 'pooja@brightminds.edu', '+91 98400 66666', 'Director', 'event', 'new', 30, 'a0000000-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. CRM — DEALS
-- ============================================================
INSERT INTO deals (id, org_id, name, account_id, contact_id, stage, probability, value, currency, expected_close_date, source, next_step, owner_id)
VALUES
  ('13000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TechNova — Enterprise License', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'negotiation', 70, 1200000, 'INR', '2026-09-15', 'direct', 'Send revised pricing proposal', 'a0000000-0000-0000-0000-000000000001'),
  ('13000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'GreenLeaf — Starter Plan', '10000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003', 'proposal', 50, 360000, 'INR', '2026-08-30', 'referral', 'Schedule demo with ops team', 'a0000000-0000-0000-0000-000000000007'),
  ('13000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Meridian — Consulting Module', '10000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000004', 'discovery', 30, 2400000, 'INR', '2026-10-31', 'website', 'Requirements workshop scheduled', 'a0000000-0000-0000-0000-000000000001'),
  ('13000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'CloudFirst — Partnership Deal', '10000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000005', 'prospecting', 15, 5000000, 'INR', '2026-12-31', 'partner', 'Initial call with partnerships team', 'a0000000-0000-0000-0000-000000000007'),
  ('13000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'FinServe — PM Suite', null, null, 'contract_sent', 90, 900000, 'INR', '2026-08-20', 'website', 'Awaiting legal review', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12. CRM — CAMPAIGNS
-- ============================================================
INSERT INTO campaigns (id, org_id, name, type, status, description, start_date, end_date, budget_allocated, budget_spent, channel, target_audience, owner_id)
VALUES
  ('14000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Product Hunt Launch', 'product_launch', 'active', 'Launch Centr8 OS on Product Hunt with coordinated social push', '2026-08-10', '2026-08-17', 50000, 12000, 'social_media', 'Startup founders and PMs', 'a0000000-0000-0000-0000-000000000001'),
  ('14000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'LinkedIn Thought Leadership', 'content_marketing', 'active', 'Weekly posts on AI-native project management', '2026-07-01', '2026-09-30', 30000, 8500, 'linkedin', 'Enterprise ops leaders', 'a0000000-0000-0000-0000-000000000007'),
  ('14000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Webinar: Future of Work OS', 'webinar', 'planned', 'Live webinar on how AI transforms operational workflows', '2026-09-05', '2026-09-05', 25000, 0, 'email', 'Mid-market CTOs and COOs', 'a0000000-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 13. CRM — ACTIVITIES
-- ============================================================
INSERT INTO activities (id, org_id, related_type, related_id, type, subject, description, activity_date, performed_by)
VALUES
  ('15000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'deal', '13000000-0000-0000-0000-000000000001', 'meeting', 'Pricing discussion with TechNova', 'Reviewed enterprise tier pricing, they want volume discount', '2026-08-01 10:00:00+05:30', 'a0000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'deal', '13000000-0000-0000-0000-000000000002', 'call', 'Follow-up call with GreenLeaf', 'Amit wants a demo for his operations team next week', '2026-08-03 14:30:00+05:30', 'a0000000-0000-0000-0000-000000000007'),
  ('15000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'account', '10000000-0000-0000-0000-000000000001', 'note', 'Account review — TechNova', 'Strong expansion potential. They use 3 separate tools for PM, HR, and CRM today.', '2026-08-05 15:00:00+05:30', 'a0000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'deal', '13000000-0000-0000-0000-000000000005', 'email', 'Sent contract to FinServe', 'Contract sent via email for legal review', '2026-08-04 16:00:00+05:30', 'a0000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'contact', '11000000-0000-0000-0000-000000000004', 'meeting', 'Requirements workshop — Meridian', 'Deep-dive into their consulting workflow pain points', '2026-08-05 10:00:00+05:30', 'a0000000-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. FORECAST TARGETS
-- ============================================================
INSERT INTO forecast_targets (id, org_id, period, period_type, period_start, period_end, target_value, currency)
VALUES
  ('16000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2026-Q3', 'quarterly', '2026-07-01', '2026-09-30', 5000000, 'INR'),
  ('16000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2026-08', 'monthly', '2026-08-01', '2026-08-31', 2000000, 'INR')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 15. HR — ATTENDANCE (recent records for the widget/dashboard)
-- ============================================================
INSERT INTO attendance_records (id, org_id, employee_id, work_date, check_in_time, check_out_time, total_minutes, status)
VALUES
  ('17000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-08-05', '2026-08-05 09:00:00+05:30', '2026-08-05 18:30:00+05:30', 570, 'checked_out'),
  ('17000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '2026-08-05', '2026-08-05 09:15:00+05:30', '2026-08-05 18:00:00+05:30', 525, 'checked_out'),
  ('17000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', '2026-08-05', '2026-08-05 10:05:00+05:30', '2026-08-05 17:30:00+05:30', 445, 'checked_out'),
  ('17000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', '2026-08-05', '2026-08-05 08:45:00+05:30', '2026-08-05 18:15:00+05:30', 570, 'checked_out'),
  ('17000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', '2026-08-05', '2026-08-05 09:30:00+05:30', '2026-08-05 17:00:00+05:30', 450, 'checked_out'),
  ('17000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000006', '2026-08-05', '2026-08-05 09:00:00+05:30', null, null, 'checked_in'),
  -- Yesterday's data
  ('17000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-08-04', '2026-08-04 08:55:00+05:30', '2026-08-04 18:20:00+05:30', 565, 'checked_out'),
  ('17000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '2026-08-04', '2026-08-04 09:10:00+05:30', '2026-08-04 19:00:00+05:30', 590, 'checked_out'),
  ('17000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', '2026-08-04', '2026-08-04 09:00:00+05:30', '2026-08-04 17:30:00+05:30', 510, 'checked_out'),
  ('17000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', '2026-08-04', null, null, null, 'absent'),
  ('17000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', '2026-08-04', '2026-08-04 09:30:00+05:30', '2026-08-04 17:00:00+05:30', 450, 'checked_out'),
  -- Milind
  ('17000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000009', '2026-08-05', '2026-08-05 08:30:00+05:30', null, null, 'checked_in'),
  ('17000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000009', '2026-08-04', '2026-08-04 08:30:00+05:30', '2026-08-04 19:30:00+05:30', 660, 'checked_out')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 16. HR — LEAVE REQUESTS
-- ============================================================
INSERT INTO leave_requests (id, org_id, employee_id, leave_type_id, start_date, end_date, total_days, is_half_day, reason, status)
SELECT
  '18000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000003',
  lt.id,
  '2026-08-11',
  '2026-08-12',
  2,
  false,
  'Family wedding',
  'pending'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000001' AND lt.name = 'Annual Leave' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO leave_requests (id, org_id, employee_id, leave_type_id, start_date, end_date, total_days, is_half_day, reason, status)
SELECT
  '18000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000007',
  lt.id,
  '2026-08-08',
  '2026-08-08',
  0.5,
  true,
  'Doctor appointment',
  'approved'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000001' AND lt.name = 'Sick Leave' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO leave_requests (id, org_id, employee_id, leave_type_id, start_date, end_date, total_days, is_half_day, reason, status)
SELECT
  '18000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000004',
  lt.id,
  '2026-08-18',
  '2026-08-22',
  5,
  false,
  'Annual vacation',
  'pending'
FROM leave_types lt WHERE lt.org_id = '00000000-0000-0000-0000-000000000001' AND lt.name = 'Annual Leave' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 17. HR — COMPENSATION
-- ============================================================
INSERT INTO compensation_records (id, org_id, employee_id, base_salary, currency, pay_frequency, effective_date)
VALUES
  ('19000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 3000000, 'INR', 'monthly', '2026-01-01'),
  ('19000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 2400000, 'INR', 'monthly', '2026-03-15'),
  ('19000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', 1800000, 'INR', 'monthly', '2026-04-01'),
  ('19000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', 2000000, 'INR', 'monthly', '2026-04-15'),
  ('19000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', 1500000, 'INR', 'monthly', '2026-05-01'),
  ('19000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000006', 1800000, 'INR', 'monthly', '2026-05-15'),
  ('19000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000009', 3000000, 'INR', 'monthly', '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 18. HR — JOB POSTINGS (Recruitment)
-- ============================================================
INSERT INTO job_postings (id, org_id, title, department_id, location, employment_type, description, status)
VALUES
  ('1a000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Senior Full-Stack Engineer', '00000000-0000-0000-0000-0000000000d1', 'Remote (India)', 'full_time', 'Build core platform features for Centr8 OS. React, Next.js, PostgreSQL experience required.', 'open'),
  ('1a000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AI/ML Engineer', '00000000-0000-0000-0000-0000000000d1', 'Ahmedabad / Remote', 'full_time', 'Design and implement AI agent pipelines (Planner, Monitor, Analyst). LLM experience preferred.', 'open'),
  ('1a000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Product Marketing Intern', null, 'Remote', 'intern', 'Help with launch campaigns, content creation, and social media strategy.', 'open')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 19. HR — CANDIDATES
-- ============================================================
INSERT INTO candidates (id, org_id, job_posting_id, name, email, phone, stage, source, applied_at)
VALUES
  ('1b000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'Rahul Krishnan', 'rahul.k@gmail.com', '+91 97000 11111', 'screening', 'linkedin', now() - interval '5 days'),
  ('1b000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'Divya Prabhu', 'divya.p@outlook.com', '+91 97000 22222', 'interview', 'referral', now() - interval '10 days'),
  ('1b000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'Tanmay Shah', 'tanmay.s@proton.me', '+91 97000 33333', 'applied', 'website', now() - interval '2 days'),
  ('1b000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'Simran Kaur', 'simran.k@gmail.com', '+91 97000 44444', 'screening', 'job_board', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20. HR — TRAINING COURSES
-- ============================================================
INSERT INTO training_courses (id, org_id, title, description, content_type, content_url, duration_minutes, is_active)
VALUES
  ('1c000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Centr8 OS Onboarding', 'Welcome to Centr8! Learn the product, culture, and workflows.', 'document', 'https://docs.centr8.io/onboarding', 120, true),
  ('1c000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Security & Data Handling', 'Best practices for handling customer data, RLS, and auth.', 'link', 'https://docs.centr8.io/security', 60, true),
  ('1c000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'AI Agent Development Guide', 'How to build and test composable agents (Planner, Monitor, etc.)', 'document', 'https://docs.centr8.io/ai-agents', 90, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 21. HR CASE CATEGORIES + CASES
-- ============================================================
INSERT INTO hr_case_categories (id, org_id, name, description)
VALUES
  ('1d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'IT Support', 'Hardware, software, and access requests'),
  ('1d000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Policy Question', 'Questions about company policies, leave, benefits'),
  ('1d000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Workplace Issue', 'Workplace environment, conduct, or safety concerns')
ON CONFLICT (id) DO NOTHING;

INSERT INTO hr_cases (id, org_id, employee_id, category_id, subject, description, priority, status)
VALUES
  ('1e000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000007', '1d000000-0000-0000-0000-000000000001', 'Need access to staging environment', 'I need SSH access to the staging server for QA testing. Currently getting permission denied.', 'normal', 'open'),
  ('1e000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000002', 'Clarification on remote work policy', 'Can I work from Goa for 2 weeks in September? Need to know if there are any restrictions.', 'low', 'open')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 22. TASK ASSIGNEES (multi-assignee for a few tasks)
-- ============================================================
INSERT INTO task_assignees (task_id, person_id, org_id)
VALUES
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 23. TASK COMMENTS
-- ============================================================
INSERT INTO task_comments (id, org_id, task_id, author_user_id, body)
VALUES
  ('1f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', null, 'API routes for /api/dashboard are done, working on the frontend cards now.'),
  ('1f000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', null, 'Design mockups for the dashboard cards are in Figma. Let me know if you need anything.'),
  ('1f000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000010', null, 'The Gemini prompt chain is working for simple inputs. Need to handle multi-project plans next.'),
  ('1f000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', null, 'Forecast computation is done — pipeline/weighted/won values all computed live from deals. PR is up for review.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 24. TASK ATTACHMENTS
-- ============================================================
INSERT INTO task_attachments (id, org_id, task_id, file_name, file_path, file_size, mime_type, uploaded_by_user_id)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'dashboard-mockup.pdf', '/files/dashboard-mockup.pdf', 2400000, 'application/pdf', null),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006', 'task-card-reference.png', '/files/task-card-reference.png', 850000, 'image/png', null),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000010', 'planner-agent-spec.docx', '/files/planner-agent-spec.docx', 180000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 25. GOALS — assign owners
-- ============================================================
UPDATE goals SET owner_id = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'b0000000-0000-0000-0000-000000000001' AND owner_id IS NULL;
UPDATE goals SET owner_id = 'a0000000-0000-0000-0000-000000000007' WHERE id = 'b0000000-0000-0000-0000-000000000002' AND owner_id IS NULL;

-- ============================================================
-- 26. PROJECT MEMBERS — Urvil + Milind on all projects
-- ============================================================
INSERT INTO project_members (project_id, person_id, org_id, role, hours_per_week, is_lead)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Founder', 20, true),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'CTO', 15, false),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'CTO', 25, true),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Founder', 10, false),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Founder', 10, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 27. EXTRA TASK ASSIGNEES — Milind on key tasks
-- ============================================================
INSERT INTO task_assignees (task_id, person_id, org_id)
VALUES
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Milind as assignee on the agent job queue task
UPDATE tasks SET assignee_id = 'a0000000-0000-0000-0000-000000000007' WHERE id = 'e0000000-0000-0000-0000-000000000012' AND assignee_id != 'a0000000-0000-0000-0000-000000000007';

-- ============================================================
-- 28. JOB POSTING HIRING MANAGERS
-- ============================================================
UPDATE job_postings SET hiring_manager_id = 'f0000000-0000-0000-0000-000000000001' WHERE id = '1a000000-0000-0000-0000-000000000001' AND hiring_manager_id IS NULL;
UPDATE job_postings SET hiring_manager_id = 'f0000000-0000-0000-0000-000000000009' WHERE id = '1a000000-0000-0000-0000-000000000002' AND hiring_manager_id IS NULL;

END $$;
