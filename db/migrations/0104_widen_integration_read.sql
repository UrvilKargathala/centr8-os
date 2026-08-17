-- integration:read was owner/admin-only (0054) alongside integration:configure
-- — fine while the only consumer was the fully admin-gated /admin/integrations
-- page. ClickUp's Communication-pillar pages (/communication/clickup) need
-- a genuine "view" tier open to every role — connecting/disconnecting stays
-- owner/admin-only via integration:configure (unchanged), but reading task
-- data through an already-connected integration isn't a credentials action.
-- No new action value: reusing the existing 'read' action for member/viewer,
-- same "pick from the existing action vocabulary" rule as every other
-- resourceType in this schema (db/schema.ts:530-535).
insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'integration'::resource_type, 'read'::permission_action
from unnest(array['member', 'viewer']) as r(role);
