-- HR Batch 2 Part 3 — payroll:{generate,finalize,mark_paid}, owner/admin
-- only. Zero self-service by design: no member/viewer grant anywhere in
-- this pillar, matching compensation:*'s existing tightness exactly
-- (migration 0034_seed_compensation_permissions.sql).

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'payroll'::resource_type, a.action
from unnest(array['generate', 'finalize', 'mark_paid']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
