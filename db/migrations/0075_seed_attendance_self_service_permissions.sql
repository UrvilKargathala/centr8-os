-- HR Batch 2 — replaces attendance:record (owner/admin-only, migration
-- 0035's no-self-service restriction) with the 4-action self-service model.
-- record_own/view_own default to every role, including viewer, per the
-- Batch 2 spec ("check in/check out for oneself" — a viewer with a linked
-- employee record still checks themself in) — this is a deliberate
-- broadening from 0031/0035's owner/admin/member-only attendance:record.
-- view_all/edit_any stay owner/admin-only, same tier as employee:view_full.

delete from permissions where resource_type = 'attendance' and action = 'record';

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'attendance'::resource_type, a.action
from unnest(array['record_own', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'attendance'::resource_type, a.action
from unnest(array['view_all', 'edit_any']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
