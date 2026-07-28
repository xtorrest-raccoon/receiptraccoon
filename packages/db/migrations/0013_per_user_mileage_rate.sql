-- Per-user mileage rate override: null means "inherit the workspace's
-- mileage_rate_milli" (existing behavior, unchanged for everyone until an
-- owner/admin sets an override) -- lets people in different countries, with
-- different reimbursement policies, be paid at their own rate without
-- forcing the whole workspace onto one number. Owner/admin-only via
-- workspace_members' existing members_write policy -- no new RLS needed.
alter table workspace_members add column mileage_rate_milli int;
