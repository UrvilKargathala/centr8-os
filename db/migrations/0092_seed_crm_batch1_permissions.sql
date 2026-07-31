-- CRM Batch 1 — adds lead:convert, lead:assign, account:assign,
-- contact:assign on top of the existing flat create/read/update/delete
-- grants (left untouched — this only inserts the new rows, per the
-- spec's tiering):
--   Admin: all CRM permissions (existing create/read/update/delete rows
--          already cover admin fully — this adds convert/assign).
--   Editor (mapped to "member", the existing app-wide "day to day work"
--          role): view/create/update + lead:convert, but NOT delete or
--          assign — matches the spec's "Editor: ... plus lead:convert
--          (not delete/assign)".
--   Viewer: view-only, already correct, no new rows needed.
insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'lead'::resource_type, a.action
from unnest(array['convert', 'assign']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'lead'::resource_type, a.action
from unnest(array['convert']::permission_action[]) as a(action)
cross join unnest(array['member']) as r(role)

union all

select null::uuid, r.role, 'account'::resource_type, a.action
from unnest(array['assign']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'contact'::resource_type, a.action
from unnest(array['assign']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
