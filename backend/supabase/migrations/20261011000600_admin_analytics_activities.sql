-- External learning activities, administrative operations, analytics and content audit triggers.

-- ---------------------------------------------------------------------------
-- External activities (admin-configured links, e.g. a finance game)
-- ---------------------------------------------------------------------------
create table if not exists public.external_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  url text not null check (url ~ '^https://[^\s/$.?#][^\s]*$' and char_length(url) <= 2000),
  provider_name text not null default '' check (char_length(provider_name) <= 120),
  pillar_id uuid references public.learning_pillars (id) on delete set null,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists external_activities_set_updated_at on public.external_activities;
create trigger external_activities_set_updated_at
  before update on public.external_activities
  for each row execute function public.set_updated_at();

alter table public.external_activities enable row level security;
revoke all on table public.external_activities from anon, authenticated;
grant select, insert, delete on table public.external_activities to authenticated;
grant update (title, description, url, provider_name, pillar_id, is_published, sort_order)
  on table public.external_activities to authenticated;

drop policy if exists external_activities_select on public.external_activities;
create policy external_activities_select on public.external_activities for select to authenticated
  using (is_published or public.is_platform_admin());

drop policy if exists external_activities_write_admin on public.external_activities;
create policy external_activities_write_admin on public.external_activities for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Platform administration
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  account_status text,
  is_platform_admin boolean,
  membership_count integer,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.assert_platform_admin();

  return query
  select
    u.id,
    u.email::text,
    p.display_name,
    p.account_status,
    exists (select 1 from public.platform_admins pa where pa.user_id = u.id),
    (select count(*)::integer from public.organization_memberships m where m.user_id = u.id and m.status = 'approved'),
    u.created_at,
    u.last_sign_in_at,
    count(*) over ()
  from auth.users u
  join public.profiles p on p.id = u.id
  where v_search is null
     or u.email ilike '%' || v_search || '%'
     or p.display_name ilike '%' || v_search || '%'
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_set_platform_admin(p_user_id uuid, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform_admin();
begin
  if p_grant then
    insert into public.platform_admins (user_id, granted_by)
    values (p_user_id, v_uid)
    on conflict (user_id) do nothing;
  else
    if (select count(*) from public.platform_admins) <= 1 then
      raise exception 'last_platform_admin' using errcode = 'P0001';
    end if;
    delete from public.platform_admins where user_id = p_user_id;
  end if;

  perform public.log_audit(
    case when p_grant then 'role.platform_admin_granted' else 'role.platform_admin_revoked' end,
    'user', p_user_id::text, null, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_account_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform_admin();
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_user_id = v_uid then
    raise exception 'cannot_modify_self' using errcode = 'P0001';
  end if;

  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform public.log_audit('user.status_' || p_status, 'user', p_user_id::text, null, '{}'::jsonb);
end;
$$;

create or replace function public.get_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'active_learners', (select count(distinct user_id) from public.student_question_progress),
    'organizations_pending', (select count(*) from public.organizations where approval_status = 'pending'),
    'organizations_approved', (select count(*) from public.organizations where approval_status = 'approved'),
    'lessons_published', (select count(*) from public.lessons where is_published),
    'lessons_total', (select count(*) from public.lessons),
    'lessons_completed', (select count(*) from public.lesson_progress where status = 'completed'),
    'questions_core', (select count(*) from public.quiz_questions where kind = 'core'),
    'attempts_completed', (select count(*) from public.quiz_attempts where status = 'completed'),
    'attempts_passed', (select count(*) from public.quiz_attempts where passed),
    'comics_published', (select count(*) from public.remediation_comics where is_published),
    'comics_awaiting_review', (select count(*) from public.remediation_comics where review_status = 'in_review'),
    'comics_failed', (select count(*) from public.remediation_comics where generation_status = 'generation_failed')
  );
end;
$$;

-- Per-student progress for an organization; staff of that organization only.
create or replace function public.get_org_progress(p_org_id uuid)
returns table (
  user_id uuid,
  display_name text,
  student_identifier text,
  role text,
  lessons_completed integer,
  levels_passed integer,
  total_points integer,
  attempts_completed integer,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_active_user();
  if not public.is_org_staff(p_org_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  return query
  select
    m.user_id,
    p.display_name,
    p.student_identifier,
    m.role,
    (select count(*)::integer from public.lesson_progress lp where lp.user_id = m.user_id and lp.status = 'completed'),
    (select count(*)::integer from public.student_quiz_progress sp where sp.user_id = m.user_id and sp.passed_at is not null),
    (select coalesce(sum(qp.best_points), 0)::integer from public.student_question_progress qp where qp.user_id = m.user_id),
    (select count(*)::integer from public.quiz_attempts a where a.user_id = m.user_id and a.status = 'completed'),
    greatest(
      (select max(lp.last_viewed_at) from public.lesson_progress lp where lp.user_id = m.user_id),
      (select max(qa.answered_at) from public.quiz_attempt_answers qa where qa.user_id = m.user_id)
    )
  from public.organization_memberships m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org_id and m.status = 'approved'
  order by m.role, p.display_name;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_list_users(text, integer, integer)',
    'public.admin_set_platform_admin(uuid, boolean)',
    'public.admin_set_account_status(uuid, text)',
    'public.get_platform_stats()',
    'public.get_org_progress(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Content audit triggers
-- ---------------------------------------------------------------------------
create or replace function public.audit_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_id text := v_row ->> coalesce(tg_argv[0], 'id');
  v_details jsonb := '{}'::jsonb;
begin
  -- Skip writes made without a signed-in user (migrations, seeds, service tasks).
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and (to_jsonb(old) -> 'is_published') is distinct from (to_jsonb(new) -> 'is_published') then
    v_details := jsonb_build_object('is_published', to_jsonb(new) -> 'is_published');
  end if;

  perform public.log_audit(tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, null, v_details);
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_content_change() from public, anon, authenticated;

drop trigger if exists audit_lessons on public.lessons;
create trigger audit_lessons after insert or update or delete on public.lessons
  for each row execute function public.audit_content_change();

drop trigger if exists audit_quizzes on public.quizzes;
create trigger audit_quizzes after insert or update or delete on public.quizzes
  for each row execute function public.audit_content_change();

drop trigger if exists audit_quiz_questions on public.quiz_questions;
create trigger audit_quiz_questions after insert or update or delete on public.quiz_questions
  for each row execute function public.audit_content_change();

drop trigger if exists audit_quiz_options on public.quiz_options;
create trigger audit_quiz_options after insert or update or delete on public.quiz_options
  for each row execute function public.audit_content_change();

drop trigger if exists audit_quiz_answer_keys on public.quiz_answer_keys;
create trigger audit_quiz_answer_keys after insert or update or delete on public.quiz_answer_keys
  for each row execute function public.audit_content_change('question_id');

drop trigger if exists audit_remediation_comics on public.remediation_comics;
create trigger audit_remediation_comics after insert or update or delete on public.remediation_comics
  for each row execute function public.audit_content_change();

drop trigger if exists audit_external_activities on public.external_activities;
create trigger audit_external_activities after insert or update or delete on public.external_activities
  for each row execute function public.audit_content_change();
