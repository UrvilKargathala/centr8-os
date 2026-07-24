-- 'team' (resource_type) has existed in the enum since 0006 but was never
-- seeded. Wiring it up now for the people directory (Team Directory /
-- Project Management pillar).
--
-- Owner + admin get full CRUD (view + create + update + delete/deactivate);
-- member gets view + create + update (they can add teammates as they
-- onboard them but can't remove people); viewer read-only.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'team'::resource_type, a.action
from unnest(array['read', 'create', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);

insert into permissions (org_id, role, resource_type, action)
select null::uuid, 'member', 'team'::resource_type, a.action
from unnest(array['read', 'create', 'update']::permission_action[]) as a(action);

insert into permissions (org_id, role, resource_type, action)
values (null::uuid, 'viewer', 'team'::resource_type, 'read'::permission_action);
