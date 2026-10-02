-- Pa-Nashe Tracker · initial schema for Supabase
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Then add the two members (see supabase/members.example.sql).

-- ─────────────────────────────────────────────────────────────
-- 1. Who may use the tracker (allow-list by sign-in email)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.members (
  email      text primary key,
  person     text not null check (person in ('P', 'M')),
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select to authenticated using (public.is_member());

-- ─────────────────────────────────────────────────────────────
-- 2. Documents: one row per prototype document
--    collection ∈ config | months | milestones, id = doc id, data = the JSON document
-- ─────────────────────────────────────────────────────────────
create table if not exists public.docs (
  collection text   not null check (collection in ('config', 'months', 'milestones')),
  id         text   not null check (length(id) between 1 and 200),
  data       jsonb  not null default '{}'::jsonb,
  version    bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (collection, id)
);
alter table public.docs enable row level security;

drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_select on public.docs for select to authenticated using (public.is_member());
create policy docs_insert on public.docs for insert to authenticated with check (public.is_member());
create policy docs_update on public.docs for update to authenticated using (public.is_member()) with check (public.is_member());
create policy docs_delete on public.docs for delete to authenticated using (public.is_member());

grant select, insert, update, delete on public.docs to authenticated;
grant select on public.members to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Deep merge – the prototype's update() semantics
--    objects merge key by key (recursively); anything else (arrays, numbers, strings, null) replaces.
--    A JSON null is stored as null: it is a tombstone meaning "deleted".
-- ─────────────────────────────────────────────────────────────
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  k text;
begin
  if a is null or jsonb_typeof(a) <> 'object' or b is null or jsonb_typeof(b) <> 'object' then
    return b;
  end if;
  result := a;
  for k in select jsonb_object_keys(b) loop
    if result ? k and jsonb_typeof(result -> k) = 'object' and jsonb_typeof(b -> k) = 'object' then
      result := jsonb_set(result, array[k], public.jsonb_deep_merge(result -> k, b -> k));
    else
      result := jsonb_set(result, array[k], b -> k, true);
    end if;
  end loop;
  return result;
end;
$$;

-- doc_set: full replace (creates if missing). Returns the new version.
create or replace function public.doc_set(p_collection text, p_id text, p_data jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare v bigint;
begin
  insert into public.docs (collection, id, data, updated_by)
  values (p_collection, p_id, p_data, auth.uid())
  on conflict (collection, id) do update
    set data = excluded.data, version = public.docs.version + 1, updated_at = now(), updated_by = auth.uid()
  returning version into v;
  return v;
end;
$$;

-- doc_merge: atomic deep merge on the server (creates the document if missing).
-- Two people saving different entries to the same month at the same moment both survive.
create or replace function public.doc_merge(p_collection text, p_id text, p_patch jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare v bigint;
begin
  insert into public.docs (collection, id, data, updated_by)
  values (p_collection, p_id, p_patch, auth.uid())
  on conflict (collection, id) do update
    set data = public.jsonb_deep_merge(public.docs.data, excluded.data),
        version = public.docs.version + 1, updated_at = now(), updated_by = auth.uid()
  returning version into v;
  return v;
end;
$$;

grant execute on function public.doc_set(text, text, jsonb) to authenticated;
grant execute on function public.doc_merge(text, text, jsonb) to authenticated;
grant execute on function public.jsonb_deep_merge(jsonb, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Realtime: both phones see each other's changes live
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.docs;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Files (receipts, invoices): private bucket, members only
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

drop policy if exists files_select on storage.objects;
drop policy if exists files_insert on storage.objects;
drop policy if exists files_update on storage.objects;
drop policy if exists files_delete on storage.objects;
create policy files_select on storage.objects for select to authenticated using (bucket_id = 'files' and public.is_member());
create policy files_insert on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_member());
create policy files_update on storage.objects for update to authenticated using (bucket_id = 'files' and public.is_member());
create policy files_delete on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_member());
