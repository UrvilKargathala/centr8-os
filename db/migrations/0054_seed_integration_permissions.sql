-- 'integration' (resource_type) was added in 0052 — separate migration for
-- the same reason as every prior enum-value + seed pair (0009/0010, ...,
-- 0049/0051): Postgres won't let a new enum value be used in the same
-- transaction that adds it.
--
-- owner/admin only, same tightness as sso/api_key/portal:configure —
-- connected integration credentials are org-wide, not per-user.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'integration'::resource_type, a.action
from unnest(array['configure', 'read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
