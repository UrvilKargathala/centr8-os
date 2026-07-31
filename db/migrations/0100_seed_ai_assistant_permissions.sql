-- AI Assistant build-out — sprint_plan + document tiering.
--   sprint_plan:read     — every role (view proposals).
--   sprint_plan:create   — owner/admin/member ("PM, admin" per spec; this
--                          app's flat "member" tier stands in for PM, same
--                          precedent as lead:convert/deal:close).
--   sprint_plan:approve  — owner/admin/member (approve/reject a proposal —
--                          same tier as create, per spec "PM, admin").
--   document:read        — every role.
--   document:create      — owner/admin/member (generate + edit while draft).
--   document:update      — owner/admin/member (mark reviewed — spec calls
--                          this "document:review"; reusing the existing
--                          "update" action rather than adding a new enum
--                          value, since it's the same "review my own team's
--                          draft" tier as create).
--   document:finalize    — owner/admin only (irreversible lock).
delete from permissions where resource_type = 'sprint_plan';
delete from permissions where resource_type = 'document';

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'sprint_plan'::resource_type, a.action
from unnest(array['read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'sprint_plan'::resource_type, a.action
from unnest(array['create', 'approve']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'document'::resource_type, a.action
from unnest(array['read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'document'::resource_type, a.action
from unnest(array['create', 'update']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'document'::resource_type, a.action
from unnest(array['finalize']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
