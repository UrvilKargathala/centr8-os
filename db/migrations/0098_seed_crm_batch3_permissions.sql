-- CRM Batch 3 — forecast + campaign tiering.
--   forecast:read      — every role (view forecasts/pipeline data).
--   forecast:set_target — owner/admin/member ("managers, admin only" per
--                          spec; "member" is this app's stand-in for a
--                          sales-manager-ish role, same tier lead:convert
--                          got in Batch 1 — no dedicated "manager" role
--                          exists in this app's role model).
--   campaign:read       — every role.
--   campaign:create/update/delete — owner/admin only ("create/manage for
--                          admin only" per spec — tighter than the old
--                          flat grant, which also gave member full CRUD).
delete from permissions where resource_type = 'forecast';
delete from permissions where resource_type = 'campaign';

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'forecast'::resource_type, a.action
from unnest(array['read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'forecast'::resource_type, a.action
from unnest(array['set_target']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'campaign'::resource_type, a.action
from unnest(array['read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'campaign'::resource_type, a.action
from unnest(array['create', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
