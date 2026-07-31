-- CRM Batch 2 — adds deal:close and deal:assign on top of the existing
-- flat create/read/update/delete grants (left untouched):
--   Admin: all deal permissions (existing rows already cover
--          create/read/update/delete — this adds close/assign).
--   Editor (mapped to "member"): view/create/update + deal:close, but NOT
--          delete/assign, matching the spec's "Editor: ... plus close
--          (not delete/assign)" — same shape as lead:convert in Batch 1.
--   Viewer: view-only, already correct, no new rows needed.
insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'deal'::resource_type, a.action
from unnest(array['close', 'assign']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'deal'::resource_type, a.action
from unnest(array['close']::permission_action[]) as a(action)
cross join unnest(array['member']) as r(role);
