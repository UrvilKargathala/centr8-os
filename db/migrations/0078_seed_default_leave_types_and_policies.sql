-- HR Batch 2 — seed 4 default leave types + one policy each, per org.
-- Colors are DESIGN_SYSTEM.md token hex values (primary/danger/info/neutral
-- -600), not arbitrary picks. Org 00000000-0000-0000-0000-000000000001
-- also keeps its pre-existing 'PTO' type/policy from migration 0077 —
-- these defaults are additive, not a replacement for it.

insert into leave_types (org_id, name, description, color, requires_approval, is_paid, is_active)
select id, 'Annual Leave', 'Planned time off, booked in advance.', '#2E62F0', true, true, true from organizations
union all
select id, 'Sick Leave', 'Health-related absence.', '#C13B3B', true, true, true from organizations
union all
select id, 'Casual Leave', 'Short-notice personal time off.', '#2E7BB0', true, true, true from organizations
union all
select id, 'Unpaid Leave', 'Unpaid time off — no annual ceiling enforced.', '#5B5F68', true, false, true from organizations;

insert into leave_policies (org_id, leave_type_id, name, applies_to, annual_allotment_days, accrual_method, carry_forward_max_days, effective_from, is_active)
select lt.org_id, lt.id, lt.name || ' — Standard', 'all',
  case lt.name
    when 'Annual Leave' then 18
    when 'Sick Leave' then 10
    when 'Casual Leave' then 6
    when 'Unpaid Leave' then 0 -- is_paid=false bypasses the balance ceiling entirely; not a real allotment
  end,
  'annual_lump_sum', 0, '2026-01-01', true
from leave_types lt
where lt.name in ('Annual Leave', 'Sick Leave', 'Casual Leave', 'Unpaid Leave');
