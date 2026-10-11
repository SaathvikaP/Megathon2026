-- Core identity: profiles, platform administrators, audit log, shared helpers.
-- Authentication itself is handled by Supabase Auth (auth.users); no passwords are stored here.
-- Every statement is written to be safe to re-run.

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  student_identifier text check (student_identifier is null or char_length(student_identifier) <= 40),
  grade_level smallint check (grade_level is null or grade_level in (11, 12)),
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1), ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up before this migration.
insert into public.profiles (id, display_name)
select u.id, left(split_part(coalesce(u.email, ''), '@', 1), 80)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Platform administrators
-- Rows can only be created by the SQL editor / service role, or by an existing
-- platform administrator through admin_set_platform_admin().
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    where pa.user_id = auth.uid()
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_status = 'active'
  );
$$;

-- Raises unless the caller is a signed-in, non-suspended user.
create or replace function public.assert_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not public.is_active_user() then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

create or replace function public.assert_platform_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log (never store passwords, tokens or answer choices of students here)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  organization_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_organization_idx on public.audit_log (organization_id, created_at desc);

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_organization_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, organization_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_organization_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Internal only: callable from other security-definer functions and triggers.
revoke execute on function public.log_audit(text, text, text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_log enable row level security;

-- Supabase grants broad default privileges on new public tables; narrow them explicitly.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

grant select on table public.profiles to authenticated;
-- Users may edit only these columns; account_status and ids are never user-editable.
grant update (display_name, student_identifier, grade_level) on table public.profiles to authenticated;
grant select on table public.platform_admins to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select
  on public.platform_admins for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- profiles_select and audit_log_select depend on organization helpers and are
-- created in the organizations migration.

revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.assert_active_user() from public, anon;
revoke execute on function public.assert_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.assert_active_user() to authenticated;
grant execute on function public.assert_platform_admin() to authenticated;
