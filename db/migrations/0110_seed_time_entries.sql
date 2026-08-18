-- Seed realistic time entries for the demo org.
-- Covers the current week (2026-08-17 Mon–Sun) and 2 prior weeks.
-- Spread across 5 people, 3 projects, various tasks. Mix of billable/non-billable.
-- Guard: skip if time_entries already has data for this org.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM time_entries WHERE org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1) THEN
    RAISE NOTICE 'time_entries already seeded, skipping';
    RETURN;
  END IF;

  INSERT INTO time_entries (org_id, person_id, project_id, task_id, date, hours, description, is_billable) VALUES
    -- Week of Aug 3 (2 weeks ago)
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '47d15c5f-d171-4ab6-b63f-eca9bab740b7', '2026-08-03', 6.0, 'Neon schema setup and RLS policies', true),
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '98668719-46c3-4049-b743-3a6492c1cf92', '2026-08-04', 4.5, 'Design system tokens review', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '9b11c912-a575-4a89-a5f9-4d806f3e2c6f', '2026-08-03', 7.0, 'Planner agent prompt engineering', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '59b40670-4e05-42a5-a73d-2504e4a6edd4', '2026-08-04', 5.5, 'Monitor agent health signal parsing', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '9b11c912-a575-4a89-a5f9-4d806f3e2c6f', '2026-08-05', 3.0, 'Planner agent output schema validation', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '29fe2b4a-52bd-4198-b477-bf4384e8f38b', '2026-08-03', 6.5, 'Landing page hero section design', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '29fe2b4a-52bd-4198-b477-bf4384e8f38b', '2026-08-04', 5.0, 'Landing page responsive breakpoints', true),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '78e7a216-1d14-4afa-a436-4de7332537d5', '2026-08-03', 5.0, 'Supabase Auth RLS policy audit', true),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '30937dfd-1610-4d1e-8734-4b1f9b9f687c', '2026-08-05', 4.0, 'Leave management API routes', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '71e27699-1933-45b3-92a6-4829005987f5', '2026-08-04', 6.0, 'Dashboard cross-pillar API endpoint', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '71e27699-1933-45b3-92a6-4829005987f5', '2026-08-05', 3.5, 'Dashboard KPI card styling', false),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '1742aefb-0a1e-451b-8ebe-d0d8382d05fd', '2026-08-04', 4.0, 'SEO meta tags audit', true),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', 'd1474b0d-af41-4164-b33e-804c149924ea', '2026-08-05', 3.0, 'Launch blog post draft', false),

    -- Week of Aug 10 (last week)
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '50fb797a-bf5b-460b-89a4-140ebffbefa1', '2026-08-10', 7.0, 'Task detail card complete redesign', true),
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '50fb797a-bf5b-460b-89a4-140ebffbefa1', '2026-08-11', 5.5, 'Task detail — subtasks and dependencies UI', true),
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '09662e11-297a-4f43-bc4b-6b88861137a1', '2026-08-12', 4.0, 'Agent job queue Postgres worker', true),
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '7098ac35-725f-46bd-9c2b-6da395457339', '2026-08-13', 3.0, 'Integration connect modal UX', true),
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', NULL, '2026-08-14', 2.0, 'Sprint retro and planning', false),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '59b40670-4e05-42a5-a73d-2504e4a6edd4', '2026-08-10', 6.5, 'Monitor agent risk detection rules', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '59b40670-4e05-42a5-a73d-2504e4a6edd4', '2026-08-11', 5.0, 'Monitor agent delivery prediction model', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', NULL, '2026-08-12', 2.5, 'Code review and PR feedback', false),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '804286c6-2772-4000-86c3-a78fd93d8eb0', '2026-08-13', 6.0, 'CRM Batch 3 forecasts API', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '29fe2b4a-52bd-4198-b477-bf4384e8f38b', '2026-08-10', 5.5, 'Landing page feature sections', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '98668719-46c3-4049-b743-3a6492c1cf92', '2026-08-11', 4.0, 'Component library icon set', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', NULL, '2026-08-12', 2.0, 'Design review meeting', false),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '30937dfd-1610-4d1e-8734-4b1f9b9f687c', '2026-08-10', 6.0, 'Leave management balance calculations', true),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '30937dfd-1610-4d1e-8734-4b1f9b9f687c', '2026-08-11', 5.0, 'Leave management approval flow', true),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '7490ef4b-a10a-454a-9910-0310a5c03e7a', '2026-08-12', 3.5, 'CI pipeline Vercel deploy hooks', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '71e27699-1933-45b3-92a6-4829005987f5', '2026-08-10', 5.5, 'Dashboard recent activity feed', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '71e27699-1933-45b3-92a6-4829005987f5', '2026-08-11', 4.0, 'Dashboard Ask AI chat panel', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', NULL, '2026-08-13', 1.5, 'Team standup', false),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', 'd1474b0d-af41-4164-b33e-804c149924ea', '2026-08-10', 5.0, 'Blog post copy editing', true),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '1742aefb-0a1e-451b-8ebe-d0d8382d05fd', '2026-08-11', 3.5, 'SEO keyword research', true),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', NULL, '2026-08-12', 2.0, 'Social media content planning', false),
    ('00000000-0000-0000-0000-000000000001', '4d909957-afc1-4469-b65c-adac44d8faff', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', NULL, '2026-08-10', 3.0, 'Early access outreach planning', false),
    ('00000000-0000-0000-0000-000000000001', '4d909957-afc1-4469-b65c-adac44d8faff', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', NULL, '2026-08-12', 4.0, 'Demo script and slide deck', false),

    -- Current week (Aug 17)
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '50fb797a-bf5b-460b-89a4-140ebffbefa1', '2026-08-17', 6.5, 'Task detail — time tracking integration', true),
    ('00000000-0000-0000-0000-000000000001', '939da4a1-adff-422f-a1b6-2b3cc5fad721', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '7098ac35-725f-46bd-9c2b-6da395457339', '2026-08-18', 5.0, 'Integration modals final polish', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '09662e11-297a-4f43-bc4b-6b88861137a1', '2026-08-17', 7.0, 'Agent queue retry logic and dead letter', true),
    ('00000000-0000-0000-0000-000000000001', 'd6b212e7-ba65-4149-b296-b8e08c3ae4f1', '7c3c903c-53e4-434b-99a9-0bf366a7f362', '09662e11-297a-4f43-bc4b-6b88861137a1', '2026-08-18', 4.5, 'Agent queue monitoring dashboard', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '29fe2b4a-52bd-4198-b477-bf4384e8f38b', '2026-08-17', 5.0, 'Landing page testimonials section', true),
    ('00000000-0000-0000-0000-000000000001', '5348ec1d-2f55-44d5-8b23-25fc048d51a7', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '29fe2b4a-52bd-4198-b477-bf4384e8f38b', '2026-08-18', 3.5, 'Landing page CTA animations', true),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '7490ef4b-a10a-454a-9910-0310a5c03e7a', '2026-08-17', 5.5, 'CI pipeline parallel test runner', true),
    ('00000000-0000-0000-0000-000000000001', 'dbc6dfad-3659-47e9-8ac8-2630e738456d', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '78e7a216-1d14-4afa-a436-4de7332537d5', '2026-08-18', 4.0, 'Auth token refresh edge cases', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '804286c6-2772-4000-86c3-a78fd93d8eb0', '2026-08-17', 6.0, 'CRM campaign metrics computation', true),
    ('00000000-0000-0000-0000-000000000001', 'a8f8cb46-4e06-4f40-8bca-acbd9a0a8525', '51e8883e-4a12-4ef7-a9dc-ed3dec5ef79d', '804286c6-2772-4000-86c3-a78fd93d8eb0', '2026-08-18', 3.0, 'CRM campaign ROI null handling', true),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', 'd1474b0d-af41-4164-b33e-804c149924ea', '2026-08-17', 4.5, 'Blog post final review and images', true),
    ('00000000-0000-0000-0000-000000000001', '2c338e0b-b994-458e-ac31-ca43a03a17c4', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', '1742aefb-0a1e-451b-8ebe-d0d8382d05fd', '2026-08-18', 2.5, 'Google Search Console setup', true),
    ('00000000-0000-0000-0000-000000000001', '4d909957-afc1-4469-b65c-adac44d8faff', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', NULL, '2026-08-17', 3.5, 'Design partner outreach calls', false),
    ('00000000-0000-0000-0000-000000000001', '4d909957-afc1-4469-b65c-adac44d8faff', '93533b2c-0e96-4faa-b8c9-7fd7630445a6', NULL, '2026-08-18', 2.5, 'Pricing page competitor analysis', false);
END $$;
