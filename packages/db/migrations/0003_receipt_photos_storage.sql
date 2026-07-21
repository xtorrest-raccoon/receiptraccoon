-- RLS for the "receipts" storage bucket (created via the Storage API, not
-- SQL — buckets aren't part of the public schema). Objects are named
-- "{workspace_id}/{filename}", so the workspace is the first path segment;
-- reuses is_workspace_member() from 0001_init.sql.
--
-- Deliberately workspace-wide read/write rather than re-deriving the
-- member-sees-own/admin-sees-all split receipts_select uses — a photo is
-- lower-stakes than the reimbursement decision itself, and every other
-- sub-resource of a receipt (receipt_line_items) already follows the same
-- simpler "if you can see the parent, you can see this" shape.

create policy receipts_bucket_select on storage.objects for select
  using (
    bucket_id = 'receipts'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy receipts_bucket_insert on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy receipts_bucket_delete on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
