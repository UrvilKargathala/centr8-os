-- HR Batch 4 — replaces the old flat hr_case/training/engagement
-- {create,read,update,delete} (owner/admin-only, no self-service) with a
-- genuine self-service tiering, the same "full self-service + admin
-- resolution/authoring" shape as Attendance/Leave (CLAUDE.md §11a), not
-- Compensation's zero-self-service or Reviews' hybrid split.
--
--   hr_case:create_own / view_own   — every role (anyone can raise and see
--                                      their own case).
--   hr_case:manage                  — owner/admin only (assign, resolve,
--                                      internal notes, categories, and
--                                      org-wide oversight in one grant —
--                                      no meaningful "sees everything but
--                                      can't touch it" role in this module).
--   training:read / enroll_own / view_own — every role (browse catalog,
--                                      enroll self, track own progress).
--   training:manage / view_all_progress — owner/admin only (author
--                                      courses, see org-wide completion).
--   survey:respond / view_own       — every role (submit a response, see
--                                      own non-anonymous submission
--                                      history).
--   survey:manage / view_results    — owner/admin only (author/close
--                                      surveys, see aggregated results).
delete from permissions where resource_type = 'hr_case';
delete from permissions where resource_type = 'training';
delete from permissions where resource_type = 'engagement';

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'hr_case'::resource_type, a.action
from unnest(array['create_own', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'hr_case'::resource_type, a.action
from unnest(array['manage']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'training'::resource_type, a.action
from unnest(array['read', 'enroll_own', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'training'::resource_type, a.action
from unnest(array['manage', 'view_all_progress']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'engagement'::resource_type, a.action
from unnest(array['respond', 'view_own']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member', 'viewer']) as r(role)

union all

select null::uuid, r.role, 'engagement'::resource_type, a.action
from unnest(array['manage', 'view_results']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
