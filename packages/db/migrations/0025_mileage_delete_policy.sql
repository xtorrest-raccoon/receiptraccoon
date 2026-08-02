-- mileage_trips never got a DELETE policy in 0001_init.sql (receipts did --
-- see receipts_delete just above mileage's own policies there), so any
-- delete -- via the app's deleteMileageTrip() or a direct client call --
-- has silently affected zero rows this whole time while still reporting
-- success (Postgres RLS with no matching policy for a command just filters
-- the row set to nothing, it doesn't error). Same shape as receipts_delete:
-- your own trip, or any workspace admin.
create policy mileage_delete on mileage_trips for delete using (
  user_id = auth.uid() or is_workspace_admin(workspace_id)
);
