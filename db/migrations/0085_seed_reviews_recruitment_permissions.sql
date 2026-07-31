-- HR Batch 3 — replaces the old flat performance:{create,read,update,delete}
-- (owner/admin-only, no self/manager tier) with review:*/okr:* grants, and
-- broadens recruitment:read to include member (hiring managers can be any
-- role) while adding the new finer-grained recruitment actions.
--
-- Tiering, matching the hybrid self+manager pattern (distinct from
-- Attendance/Leave's full self-service and Compensation's zero-self-
-- service — see CLAUDE.md §11a):
--   review:submit_self / view_own   — every role (an employee always has
--                                      a self-assessment to fill).
--   review:submit_manager / view_team — owner/admin/member. The grant
--                                      alone isn't sufficient — application
--                                      code (requireReviewManagerAccess)
--                                      still requires the caller to
--                                      actually be that employee's manager,
--                                      same shape as leave:approve.
--   review:view_all / configure     — owner/admin only (HR admin).
--   okr:create_own / view_own       — every role.
--   okr:create_team / view_team     — owner/admin/member (manager tier).
--   okr:view_all                    — owner/admin only.
--   recruitment:manage_candidates / schedule_interview / submit_feedback
--                                    — owner/admin/member (hiring-manager/
--                                      interviewer tier); application code
--                                      further restricts submit_feedback to
--                                      the specific assigned interviewer.
--   recruitment:create_job          — owner/admin only.

delete from permissions where resource_type = 'performance';
delete from permissions where resource_type = 'recruitment';

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'review'::resource_type, a.action
from unnest(array['submit_self', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'review'::resource_type, a.action
from unnest(array['submit_manager', 'view_team']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'review'::resource_type, a.action
from unnest(array['view_all', 'configure']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'okr'::resource_type, a.action
from unnest(array['create_own', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'okr'::resource_type, a.action
from unnest(array['create_team', 'view_team']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'okr'::resource_type, 'view_all'::permission_action
from unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'recruitment'::resource_type, 'read'::permission_action
from unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'recruitment'::resource_type, a.action
from unnest(array['manage_candidates', 'schedule_interview', 'submit_feedback']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'recruitment'::resource_type, 'create_job'::permission_action
from unnest(array['owner', 'admin']) as r(role);
