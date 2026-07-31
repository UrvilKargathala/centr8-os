-- 3 default onboarding templates, org_id null = visible to every org (same
-- built-in-default pattern as permissions' org_id-null rows). Reuses the
-- generic `templates` table (name + structure jsonb) rather than a
-- dedicated onboarding_templates table — onboarding_workflows.template_id
-- already FKs to templates.id from Prompt 5.1, so this is the table that
-- was always meant to hold them; structure = { description, applies_to_role,
-- steps: [...] }.

insert into templates (org_id, name, structure) values
(null, 'Generic Employee Onboarding', '{
  "description": "Standard onboarding checklist for any new hire, regardless of role.",
  "applies_to_role": null,
  "steps": [
    {"step_id": "g1",  "title": "Sign offer letter",                 "description": "Countersigned offer letter on file.",              "category": "paperwork",    "owner_role": "HR",     "days_after_start": -7},
    {"step_id": "g2",  "title": "Submit ID documents",                "description": "Government ID + proof of address.",                 "category": "paperwork",    "owner_role": "HR",     "days_after_start": -3},
    {"step_id": "g3",  "title": "Complete tax forms",                 "description": "PAN/tax declaration paperwork.",                     "category": "paperwork",    "owner_role": "HR",     "days_after_start": 0},
    {"step_id": "g4",  "title": "Sign confidentiality agreement",     "description": "NDA and IP assignment.",                             "category": "paperwork",    "owner_role": "HR",     "days_after_start": 0},
    {"step_id": "g5",  "title": "Provision work email",               "description": "Company email + calendar access.",                  "category": "setup",        "owner_role": "IT",     "days_after_start": -1},
    {"step_id": "g6",  "title": "Issue laptop and equipment",         "description": "Laptop, monitor, peripherals.",                      "category": "setup",        "owner_role": "IT",     "days_after_start": 0},
    {"step_id": "g7",  "title": "Grant tool access",                  "description": "Slack, project tools, HR system logins.",           "category": "setup",        "owner_role": "IT",     "days_after_start": 0},
    {"step_id": "g8",  "title": "Set up payroll details",             "description": "Bank details + payroll enrollment.",                 "category": "setup",        "owner_role": "HR",     "days_after_start": 0},
    {"step_id": "g9",  "title": "Welcome message",                    "description": "Team announcement + welcome note.",                 "category": "orientation",  "owner_role": "Manager", "days_after_start": 0},
    {"step_id": "g10", "title": "Office / workspace tour",             "description": "Physical or virtual tour of the workspace.",        "category": "orientation",  "owner_role": "Manager", "days_after_start": 0},
    {"step_id": "g11", "title": "Meet the team",                      "description": "Intro meetings with immediate team.",                "category": "orientation",  "owner_role": "Manager", "days_after_start": 1},
    {"step_id": "g12", "title": "Company overview training",          "description": "Mission, values, org structure.",                   "category": "training",     "owner_role": "HR",     "days_after_start": 2},
    {"step_id": "g13", "title": "Compliance & security training",     "description": "Data handling, security policy.",                   "category": "training",     "owner_role": "HR",     "days_after_start": 3},
    {"step_id": "g14", "title": "First 1:1 with manager",             "description": "Set expectations for the first 30 days.",           "category": "assignments",  "owner_role": "Manager", "days_after_start": 3},
    {"step_id": "g15", "title": "First assigned task",                "description": "Small, well-scoped first task.",                    "category": "assignments",  "owner_role": "Manager", "days_after_start": 5}
  ]
}'::jsonb),
(null, 'Developer Onboarding', '{
  "description": "Tech-heavy onboarding for engineering hires.",
  "applies_to_role": "Developer",
  "steps": [
    {"step_id": "d1",  "title": "Sign offer letter",                 "description": "Countersigned offer letter on file.",               "category": "paperwork",    "owner_role": "HR",       "days_after_start": -7},
    {"step_id": "d2",  "title": "Submit ID documents",                "description": "Government ID + proof of address.",                  "category": "paperwork",    "owner_role": "HR",       "days_after_start": -3},
    {"step_id": "d3",  "title": "Sign confidentiality + IP agreement","description": "NDA and IP assignment.",                              "category": "paperwork",    "owner_role": "HR",       "days_after_start": 0},
    {"step_id": "d4",  "title": "Provision work email",               "description": "Company email + calendar access.",                   "category": "setup",        "owner_role": "IT",       "days_after_start": -1},
    {"step_id": "d5",  "title": "Issue dev laptop",                   "description": "Laptop with required specs for local dev.",          "category": "setup",        "owner_role": "IT",       "days_after_start": 0},
    {"step_id": "d6",  "title": "Grant GitHub / repo access",         "description": "Org membership + repo permissions.",                 "category": "setup",        "owner_role": "Engineering", "days_after_start": 0},
    {"step_id": "d7",  "title": "Set up local dev environment",       "description": "Clone repos, install toolchain, run the app locally.", "category": "setup",      "owner_role": "Engineering", "days_after_start": 0},
    {"step_id": "d8",  "title": "Grant cloud/infra access",           "description": "Vercel, Neon, Supabase, deploy permissions.",         "category": "setup",        "owner_role": "Engineering", "days_after_start": 1},
    {"step_id": "d9",  "title": "Welcome message",                    "description": "Team announcement + welcome note.",                  "category": "orientation",  "owner_role": "Manager",  "days_after_start": 0},
    {"step_id": "d10", "title": "Meet the engineering team",          "description": "Intro meetings with the eng team.",                  "category": "orientation",  "owner_role": "Manager",  "days_after_start": 1},
    {"step_id": "d11", "title": "Architecture walkthrough",           "description": "Codebase tour, stack overview, key decisions.",      "category": "training",     "owner_role": "Engineering", "days_after_start": 2},
    {"step_id": "d12", "title": "Code review process training",       "description": "PR conventions, review expectations.",               "category": "training",     "owner_role": "Engineering", "days_after_start": 2},
    {"step_id": "d13", "title": "CI/CD walkthrough",                  "description": "Build pipeline, deploy process, environments.",      "category": "training",     "owner_role": "Engineering", "days_after_start": 3},
    {"step_id": "d14", "title": "Compliance & security training",     "description": "Data handling, security policy.",                    "category": "training",     "owner_role": "HR",       "days_after_start": 3},
    {"step_id": "d15", "title": "First 1:1 with manager",             "description": "Set expectations for the first 30 days.",            "category": "assignments",  "owner_role": "Manager",  "days_after_start": 3},
    {"step_id": "d16", "title": "Pair on a starter ticket",           "description": "Shadow a teammate on a small real ticket.",           "category": "assignments",  "owner_role": "Engineering", "days_after_start": 4},
    {"step_id": "d17", "title": "Ship first PR",                     "description": "Small, well-scoped first pull request merged.",      "category": "assignments",  "owner_role": "Engineering", "days_after_start": 7},
    {"step_id": "d18", "title": "30-day check-in",                   "description": "Review progress and set next milestones.",           "category": "assignments",  "owner_role": "Manager",  "days_after_start": 30}
  ]
}'::jsonb),
(null, 'Sales Onboarding', '{
  "description": "CRM and product-training focused onboarding for sales hires.",
  "applies_to_role": "Sales",
  "steps": [
    {"step_id": "s1",  "title": "Sign offer letter",                 "description": "Countersigned offer letter on file.",               "category": "paperwork",   "owner_role": "HR",    "days_after_start": -7},
    {"step_id": "s2",  "title": "Submit ID documents",                "description": "Government ID + proof of address.",                  "category": "paperwork",   "owner_role": "HR",    "days_after_start": -3},
    {"step_id": "s3",  "title": "Sign confidentiality agreement",     "description": "NDA covering client and pipeline data.",             "category": "paperwork",   "owner_role": "HR",    "days_after_start": 0},
    {"step_id": "s4",  "title": "Provision work email",               "description": "Company email + calendar access.",                   "category": "setup",       "owner_role": "IT",    "days_after_start": -1},
    {"step_id": "s5",  "title": "Issue laptop and phone",             "description": "Laptop + work phone line if applicable.",            "category": "setup",       "owner_role": "IT",    "days_after_start": 0},
    {"step_id": "s6",  "title": "Grant CRM access",                   "description": "Centr8 CRM login, pipeline visibility.",              "category": "setup",       "owner_role": "Sales",  "days_after_start": 0},
    {"step_id": "s7",  "title": "Welcome message",                    "description": "Team announcement + welcome note.",                  "category": "orientation", "owner_role": "Manager", "days_after_start": 0},
    {"step_id": "s8",  "title": "Meet the sales team",                "description": "Intro meetings with immediate team.",                "category": "orientation", "owner_role": "Manager", "days_after_start": 1},
    {"step_id": "s9",  "title": "Product training",                   "description": "Full walkthrough of the product and positioning.",   "category": "training",    "owner_role": "Product", "days_after_start": 2},
    {"step_id": "s10", "title": "CRM & pipeline process training",    "description": "Lead stages, deal hygiene, forecasting.",            "category": "training",    "owner_role": "Sales",  "days_after_start": 3},
    {"step_id": "s11", "title": "Shadow a live sales call",           "description": "Sit in on a teammate''s client call.",                "category": "assignments", "owner_role": "Manager", "days_after_start": 4},
    {"step_id": "s12", "title": "First 1:1 with manager",             "description": "Set expectations and first-quarter targets.",        "category": "assignments", "owner_role": "Manager", "days_after_start": 5}
  ]
}'::jsonb);
