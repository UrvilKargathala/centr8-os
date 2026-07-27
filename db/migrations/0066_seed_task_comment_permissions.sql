-- 'task_comment' resource_type added in 0064. Comments are the first
-- collaboration surface — owner/admin/member all get full CRUD (same tier
-- as task itself), viewer read-only.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'task_comment'::resource_type, a.action
from unnest(array['read', 'create', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role);

insert into permissions (org_id, role, resource_type, action)
values (null::uuid, 'viewer', 'task_comment'::resource_type, 'read'::permission_action);
