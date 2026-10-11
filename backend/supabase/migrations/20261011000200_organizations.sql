-- Organizations (schools / NGOs), memberships and join codes.
-- All writes go through security-definer functions that enforce role rules;
-- tables expose read access only through RLS.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  org_type text not null check (org_type in ('school', 'ngo')),
  description text check (description is null or char_length(description) <= 1000),
  city text check (city is null or char_length(city) <= 80),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_approval_status_idx on public.organizations (approval_status);
create index if not exists organizations_created_by_idx on public.organizations (created_by);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_join_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8,16}$'),
  -- Join codes can never grant organization_admin.
  role text not null default 'student' check (role in ('student', 'teacher')),
  requires_approval boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists organization_join_codes_org_idx on public.organization_join_codes (organization_id);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'organization_admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  joined_via_code_id uuid references public.organization_join_codes (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx on public.organization_memberships (user_id);
create index if not exists organization_memberships_org_status_idx
  on public.organization_memberships (organization_id, status, role);

drop trigger if exists organization_memberships_set_updated_at on public.organization_memberships;
create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();

-- Failed join-code attempts, used to throttle code guessing.
create table if not exists public.join_code_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists join_code_failures_user_idx on public.join_code_failures (user_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- Approved member (any role) of an approved organization.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
      and o.approval_status = 'approved'
  );
$$;

-- Organization admin of an approved organization (or platform admin).
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or (
    public.is_active_user() and exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = p_org_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
        and m.role = 'organization_admin'
        and o.approval_status = 'approved'
    )
  );
$$;

-- Teacher or organization admin of an approved organization (or platform admin).
create or replace function public.is_org_staff(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or (
    public.is_active_user() and exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = p_org_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
        and m.role in ('teacher', 'organization_admin')
        and o.approval_status = 'approved'
    )
  );
$$;

-- Can the caller see this student's learning records?
-- Self, platform admins, or staff of an approved organization where the student
-- is an approved member.
create or replace function public.can_view_student_data(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.organization_memberships student_m
      where student_m.user_id = p_user_id
        and student_m.status = 'approved'
        and public.is_org_staff(student_m.organization_id)
    );
$$;

-- Can the caller see this user's profile (display name etc.)?
-- Additionally lets org admins see pending applicants to their organization.
create or replace function public.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_student_data(p_user_id)
    or exists (
      select 1
      from public.organization_memberships m
      where m.user_id = p_user_id
        and public.is_org_admin(m.organization_id)
    );
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.generate_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 10 characters from gen_random_uuid() (cryptographically random), uppercase.
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

create or replace function public.request_organization(
  p_name text,
  p_org_type text,
  p_description text default null,
  p_city text default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_org_id uuid;
  v_pending integer;
begin
  select count(*) into v_pending
  from public.organizations
  where created_by = v_uid and approval_status = 'pending';

  if v_pending >= 3 then
    raise exception 'too_many_pending_requests' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, org_type, description, city, contact_email, created_by)
  values (
    trim(p_name),
    p_org_type,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_contact_email, '')), ''),
    v_uid
  )
  returning id into v_org_id;

  -- The requester becomes organization admin. These powers only take effect
  -- once a platform administrator approves the organization.
  insert into public.organization_memberships (organization_id, user_id, role, status, reviewed_at)
  values (v_org_id, v_uid, 'organization_admin', 'approved', now());

  perform public.log_audit('organization.requested', 'organization', v_org_id::text, v_org_id,
    jsonb_build_object('org_type', p_org_type));

  return v_org_id;
end;
$$;

create or replace function public.review_organization(
  p_org_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform_admin();
begin
  if p_decision not in ('approved', 'rejected', 'suspended', 'pending') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;

  update public.organizations
  set approval_status = p_decision,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = v_uid,
      reviewed_at = now()
  where id = p_org_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform public.log_audit('organization.' || p_decision, 'organization', p_org_id::text, p_org_id, '{}'::jsonb);
end;
$$;

create or replace function public.create_join_code(
  p_org_id uuid,
  p_role text default 'student',
  p_requires_approval boolean default true,
  p_max_uses integer default null,
  p_expires_in_days integer default 30
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_code text;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_role not in ('student', 'teacher') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if p_expires_in_days is not null and (p_expires_in_days < 1 or p_expires_in_days > 365) then
    raise exception 'invalid_expiry' using errcode = 'P0001';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 5000) then
    raise exception 'invalid_max_uses' using errcode = 'P0001';
  end if;

  loop
    v_code := public.generate_join_code();
    begin
      insert into public.organization_join_codes
        (organization_id, code, role, requires_approval, max_uses, expires_at, created_by)
      values (
        p_org_id, v_code, p_role, coalesce(p_requires_approval, true), p_max_uses,
        case when p_expires_in_days is null then null else now() + make_interval(days => p_expires_in_days) end,
        v_uid
      );
      exit;
    exception when unique_violation then
      -- extremely unlikely collision; try again
    end;
  end loop;

  perform public.log_audit('join_code.created', 'organization', p_org_id::text, p_org_id,
    jsonb_build_object('role', p_role, 'requires_approval', coalesce(p_requires_approval, true)));

  return v_code;
end;
$$;

create or replace function public.revoke_join_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  perform public.assert_active_user();
  select organization_id into v_org_id from public.organization_join_codes where id = p_code_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.organization_join_codes set revoked_at = coalesce(revoked_at, now()) where id = p_code_id;
  perform public.log_audit('join_code.revoked', 'organization', v_org_id::text, v_org_id, '{}'::jsonb);
end;
$$;

create or replace function public.join_organization_with_code(p_code text)
returns table (organization_id uuid, organization_name text, membership_status text, membership_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_code public.organization_join_codes%rowtype;
  v_org public.organizations%rowtype;
  v_existing public.organization_memberships%rowtype;
  v_status text;
  v_role text;
  v_failures integer;
begin
  select count(*) into v_failures
  from public.join_code_failures f
  where f.user_id = v_uid and f.attempted_at > now() - interval '15 minutes';

  if v_failures >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  select * into v_code
  from public.organization_join_codes c
  where c.code = upper(trim(coalesce(p_code, '')))
  for update;

  if v_code.id is not null then
    select * into v_org from public.organizations o where o.id = v_code.organization_id;
  end if;

  if v_code.id is null
     or v_code.revoked_at is not null
     or (v_code.expires_at is not null and v_code.expires_at <= now())
     or (v_code.max_uses is not null and v_code.use_count >= v_code.max_uses)
     or v_org.approval_status is distinct from 'approved' then
    -- Returned (not raised) so the failure row is committed for throttling.
    -- One generic result so codes cannot be probed for their state.
    insert into public.join_code_failures (user_id) values (v_uid);
    return query select null::uuid, null::text, 'invalid_code'::text, null::text;
    return;
  end if;

  select * into v_existing
  from public.organization_memberships m
  where m.organization_id = v_org.id and m.user_id = v_uid
  for update;

  if v_existing.id is not null then
    if v_existing.status in ('approved', 'pending') then
      -- Already a member or awaiting approval: never change role via a code.
      return query select v_org.id, v_org.name, v_existing.status, v_existing.role;
      return;
    end if;
    -- Previously rejected/revoked members must be re-approved by an admin.
    update public.organization_memberships m
    set status = 'pending', role = v_code.role, joined_via_code_id = v_code.id,
        reviewed_by = null, reviewed_at = null
    where m.id = v_existing.id;
    v_status := 'pending';
    v_role := v_code.role;
  else
    v_status := case when v_code.requires_approval then 'pending' else 'approved' end;
    v_role := v_code.role;
    insert into public.organization_memberships (organization_id, user_id, role, status, joined_via_code_id)
    values (v_org.id, v_uid, v_role, v_status, v_code.id);
  end if;

  update public.organization_join_codes c set use_count = c.use_count + 1 where c.id = v_code.id;

  perform public.log_audit('membership.joined_with_code', 'organization', v_org.id::text, v_org.id,
    jsonb_build_object('status', v_status, 'role', v_role));

  return query select v_org.id, v_org.name, v_status, v_role;
end;
$$;

create or replace function public.review_membership(p_membership_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_m public.organization_memberships%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'revoked') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;

  select * into v_m from public.organization_memberships where id = p_membership_id for update;
  if v_m.id is null or not public.is_org_admin(v_m.organization_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_m.user_id = v_uid and not public.is_platform_admin() then
    raise exception 'cannot_modify_own_membership' using errcode = 'P0001';
  end if;
  if v_m.role = 'organization_admin' and not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.organization_memberships
  set status = p_decision, reviewed_by = v_uid, reviewed_at = now()
  where id = p_membership_id;

  perform public.log_audit('membership.' || p_decision, 'membership', p_membership_id::text, v_m.organization_id,
    jsonb_build_object('role', v_m.role));
end;
$$;

create or replace function public.set_membership_role(p_membership_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_m public.organization_memberships%rowtype;
begin
  if p_role not in ('student', 'teacher', 'organization_admin') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  select * into v_m from public.organization_memberships where id = p_membership_id for update;
  if v_m.id is null or not public.is_org_admin(v_m.organization_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  -- Only platform admins can grant or remove the organization_admin role.
  if (p_role = 'organization_admin' or v_m.role = 'organization_admin') and not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_m.user_id = v_uid and not public.is_platform_admin() then
    raise exception 'cannot_modify_own_membership' using errcode = 'P0001';
  end if;

  update public.organization_memberships set role = p_role where id = p_membership_id;

  perform public.log_audit('membership.role_changed', 'membership', p_membership_id::text, v_m.organization_id,
    jsonb_build_object('from', v_m.role, 'to', p_role));
end;
$$;

create or replace function public.leave_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  delete from public.organization_memberships
  where organization_id = p_org_id and user_id = v_uid and role <> 'organization_admin';
  if not found then
    raise exception 'cannot_leave' using errcode = 'P0001';
  end if;
  perform public.log_audit('membership.left', 'organization', p_org_id::text, p_org_id, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_join_codes enable row level security;
alter table public.join_code_failures enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.organization_join_codes from anon, authenticated;
revoke all on table public.join_code_failures from anon, authenticated;

grant select on table public.organizations to authenticated;
grant update (name, description, city, contact_email) on table public.organizations to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select on table public.organization_join_codes to authenticated;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select
  on public.organizations for select
  to authenticated
  using (
    public.is_platform_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.status in ('approved', 'pending')
    )
  );

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
  on public.organizations for update
  to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select
  on public.organization_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_admin(organization_id)
    or (status = 'approved' and public.is_org_staff(organization_id))
  );

drop policy if exists join_codes_select on public.organization_join_codes;
create policy join_codes_select
  on public.organization_join_codes for select
  to authenticated
  using (public.is_org_admin(organization_id));

-- Policies that depend on organization helpers (declared in the identity migration).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.can_view_profile(id));

grant select on table public.audit_log to authenticated;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select
  on public.audit_log for select
  to authenticated
  using (
    public.is_platform_admin()
    or (organization_id is not null and public.is_org_admin(organization_id))
  );

-- Function privileges
revoke execute on function public.generate_join_code() from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.is_org_member(uuid)',
    'public.is_org_admin(uuid)',
    'public.is_org_staff(uuid)',
    'public.can_view_student_data(uuid)',
    'public.can_view_profile(uuid)',
    'public.request_organization(text, text, text, text, text)',
    'public.review_organization(uuid, text, text)',
    'public.create_join_code(uuid, text, boolean, integer, integer)',
    'public.revoke_join_code(uuid)',
    'public.join_organization_with_code(text)',
    'public.review_membership(uuid, text)',
    'public.set_membership_role(uuid, text)',
    'public.leave_organization(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
