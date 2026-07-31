-- 'onboarding' (resource_type) and 'view_full'/'assign'/'complete_step'
-- (permission_action) were added in 0069 — separate migration, same
-- reason as every prior enum-value + seed pair.
--
-- employee:view_full — HR-admin-only (owner/admin), same tightness as
-- compensation:view_sensitive. Everyone with employee:read (already
-- seeded — owner/admin/member/viewer, Prompt 5.1) sees the basic PM-level
-- fields only; view_full additionally unlocks DOB, address, notes, cost
-- rate, etc.
insert into permissions (org_id, role, resource_type, action)
values (null::uuid, 'owner', 'employee'::resource_type, 'view_full'::permission_action),
       (null::uuid, 'admin', 'employee'::resource_type, 'view_full'::permission_action);

-- compensation:update — same HR-admin-only tier as compensation:view_sensitive.
insert into permissions (org_id, role, resource_type, action)
values (null::uuid, 'owner', 'compensation'::resource_type, 'update'::permission_action),
       (null::uuid, 'admin', 'compensation'::resource_type, 'update'::permission_action);

-- onboarding:configure (template CRUD) + onboarding:assign (assign a
-- template to a person) — HR-admin-only, same tier as employee:create.
insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'onboarding'::resource_type, a.action
from unnest(array['configure', 'assign']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);

-- onboarding:complete_step — broader than configure/assign: owner/admin/
-- member can check off a step (the app-level requireEmployeeManageAccess
-- manager-fallback additionally covers a manager checking off their own
-- report's steps even without this grant).
insert into permissions (org_id, role, resource_type, action)
values (null::uuid, 'owner', 'onboarding'::resource_type, 'complete_step'::permission_action),
       (null::uuid, 'admin', 'onboarding'::resource_type, 'complete_step'::permission_action),
       (null::uuid, 'member', 'onboarding'::resource_type, 'complete_step'::permission_action);
