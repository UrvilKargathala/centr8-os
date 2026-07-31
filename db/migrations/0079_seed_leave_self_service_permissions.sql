-- HR Batch 2 — replaces leave:request (owner/admin-only, migration
-- 0035's no-self-service restriction) with the self-service action set.
-- request_own/view_own default to every role (an employee requests their
-- own leave), same breadth as attendance:record_own/view_own. leave:approve
-- broadens from owner/admin-only to include member — the actual
-- authorization check (lib/api/leave.ts's requireLeaveApproveAccess) still
-- requires the caller to be the requester's manager or hold leave:view_all,
-- so a member only gets to use this grant if they genuinely manage someone.
-- leave:configure is untouched (still owner/admin-only, unchanged from 0031).
-- leave:manage_balances is new, owner/admin-only, same tier as
-- employee:view_full.

delete from permissions where resource_type = 'leave' and action = 'request';

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'leave'::resource_type, a.action
from unnest(array['request_own', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'leave'::resource_type, 'approve'::permission_action
from unnest(array['owner', 'admin', 'member']) as r(role)
where not exists (
  select 1 from permissions p where p.org_id is null and p.role = r.role and p.resource_type = 'leave' and p.action = 'approve'
)

union all

select null::uuid, r.role, 'leave'::resource_type, a.action
from unnest(array['view_all', 'manage_balances']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
