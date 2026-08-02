-- provision-member's route (apps/web/app/api/team/provision-member/route.ts)
-- moves a newly provisioned account's workspace_members row into the
-- admin's workspace but never repointed home_workspace_id away from the
-- solo workspace handle_new_user() gave them at signup -- silently
-- blocking them from submitting any receipts/mileage ever since
-- 0024_home_workspace.sql shipped (fixed in the route going forward).
-- Backfill: anyone belonging to exactly one workspace gets that as home,
-- if it isn't already. Deliberately skips anyone in multiple workspaces
-- (e.g. an owner/admin also auditing another workspace) -- their home
-- was an intentional choice, not a leftover from this bug.
update profiles p
set home_workspace_id = wm.workspace_id
from workspace_members wm
where wm.user_id = p.id
  and p.home_workspace_id is distinct from wm.workspace_id
  and (select count(*) from workspace_members wm2 where wm2.user_id = p.id) = 1;
