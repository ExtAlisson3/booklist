-- BookList sync compatibility and Data API hardening.
-- Applied to Supabase project "Mynotes" on 2026-08-02.
-- Preserves existing rows and the (user_id, doc_key) upsert contract.

alter table public.booklist_sync_documents enable row level security;
alter table public.booklist_public_shares enable row level security;

alter table public.booklist_sync_documents
  drop constraint if exists booklist_sync_documents_doc_key_check;

alter table public.booklist_sync_documents
  add constraint booklist_sync_documents_doc_key_check
  check (
    char_length(doc_key) between 1 and 255
    and doc_key ~ '^[a-z0-9_:-]+$'
  );

-- Private sync documents are available only to signed-in users.
revoke all privileges on table public.booklist_sync_documents from anon;
revoke all privileges on table public.booklist_sync_documents from authenticated;
grant select, insert, update, delete
  on table public.booklist_sync_documents
  to authenticated;

-- Public shares are anonymously readable, while writes remain owner-only.
revoke all privileges on table public.booklist_public_shares from anon;
revoke all privileges on table public.booklist_public_shares from authenticated;
grant select on table public.booklist_public_shares to anon;
grant select, insert, update, delete
  on table public.booklist_public_shares
  to authenticated;

drop policy if exists booklist_sync_documents_user_policy
  on public.booklist_sync_documents;
drop policy if exists booklist_sync_documents_select_own
  on public.booklist_sync_documents;
drop policy if exists booklist_sync_documents_insert_own
  on public.booklist_sync_documents;
drop policy if exists booklist_sync_documents_update_own
  on public.booklist_sync_documents;
drop policy if exists booklist_sync_documents_delete_own
  on public.booklist_sync_documents;

create policy booklist_sync_documents_select_own
  on public.booklist_sync_documents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy booklist_sync_documents_insert_own
  on public.booklist_sync_documents
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy booklist_sync_documents_update_own
  on public.booklist_sync_documents
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy booklist_sync_documents_delete_own
  on public.booklist_sync_documents
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists booklist_public_shares_owner_write
  on public.booklist_public_shares;
drop policy if exists booklist_public_shares_read_enabled
  on public.booklist_public_shares;
drop policy if exists booklist_public_shares_select_allowed
  on public.booklist_public_shares;
drop policy if exists booklist_public_shares_insert_own
  on public.booklist_public_shares;
drop policy if exists booklist_public_shares_update_own
  on public.booklist_public_shares;
drop policy if exists booklist_public_shares_delete_own
  on public.booklist_public_shares;

create policy booklist_public_shares_select_allowed
  on public.booklist_public_shares
  for select
  to anon, authenticated
  using (
    (
      enabled = true
      and (expires_at is null or expires_at > now())
    )
    or ((select auth.uid()) = user_id)
  );

create policy booklist_public_shares_insert_own
  on public.booklist_public_shares
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy booklist_public_shares_update_own
  on public.booklist_public_shares
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy booklist_public_shares_delete_own
  on public.booklist_public_shares
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists booklist_public_shares_user_id_idx
  on public.booklist_public_shares (user_id);

notify pgrst, 'reload schema';
