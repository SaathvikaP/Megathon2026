-- Learning pillars, lessons and lesson progress.

create table if not exists public.learning_pillars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null,
  tagline text not null default '',
  description text not null default '',
  icon text not null default 'book',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists learning_pillars_set_updated_at on public.learning_pillars;
create trigger learning_pillars_set_updated_at
  before update on public.learning_pillars
  for each row execute function public.set_updated_at();

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references public.learning_pillars (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 3 and 140),
  summary text not null default '' check (char_length(summary) <= 500),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  learning_objectives text[] not null default '{}',
  -- Array of content blocks; shape validated by the application (frontend/src/lib/content/blocks.ts).
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 120),
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  -- [{ "title": "...", "publisher": "...", "url": "https://...", "note": "..." }]
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_pillar_idx on public.lessons (pillar_id, sort_order);
create index if not exists lessons_published_idx on public.lessons (is_published);

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create or replace function public.lessons_track_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := coalesce(new.published_at, now());
  end if;
  if tg_op = 'UPDATE' then
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists lessons_track_publication on public.lessons;
create trigger lessons_track_publication
  before insert or update on public.lessons
  for each row execute function public.lessons_track_publication();

create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- restrict: a lesson with student progress must be unpublished, not deleted.
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Records that the student opened a lesson. Never marks it complete.
create or replace function public.start_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  if not exists (select 1 from public.lessons where id = p_lesson_id and is_published) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.lesson_progress (user_id, lesson_id)
  values (v_uid, p_lesson_id)
  on conflict (user_id, lesson_id) do update set last_viewed_at = now();
end;
$$;

-- Explicit completion action by the student.
create or replace function public.complete_lesson(p_lesson_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_completed timestamptz;
begin
  if not exists (select 1 from public.lessons where id = p_lesson_id and is_published) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.lesson_progress (user_id, lesson_id, status, completed_at)
  values (v_uid, p_lesson_id, 'completed', now())
  on conflict (user_id, lesson_id) do update
    set status = 'completed',
        completed_at = coalesce(public.lesson_progress.completed_at, now()),
        last_viewed_at = now()
  returning completed_at into v_completed;

  return v_completed;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.learning_pillars enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;

revoke all on table public.learning_pillars from anon, authenticated;
revoke all on table public.lessons from anon, authenticated;
revoke all on table public.lesson_progress from anon, authenticated;

grant select on table public.learning_pillars to authenticated;
grant update (title, tagline, description, icon, sort_order) on table public.learning_pillars to authenticated;
grant select, insert, delete on table public.lessons to authenticated;
grant update (
  pillar_id, slug, title, summary, difficulty, learning_objectives, content,
  estimated_minutes, is_published, sort_order, source_references
) on table public.lessons to authenticated;
grant select on table public.lesson_progress to authenticated;

drop policy if exists pillars_select on public.learning_pillars;
create policy pillars_select on public.learning_pillars for select to authenticated using (true);

drop policy if exists pillars_update_admin on public.learning_pillars;
create policy pillars_update_admin on public.learning_pillars for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using (is_published or public.is_platform_admin());

drop policy if exists lessons_insert_admin on public.lessons;
create policy lessons_insert_admin on public.lessons for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists lessons_update_admin on public.lessons;
create policy lessons_update_admin on public.lessons for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists lessons_delete_admin on public.lessons;
create policy lessons_delete_admin on public.lessons for delete to authenticated
  using (public.is_platform_admin());

drop policy if exists lesson_progress_select on public.lesson_progress;
create policy lesson_progress_select on public.lesson_progress for select to authenticated
  using (public.can_view_student_data(user_id));

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.start_lesson(uuid)',
    'public.complete_lesson(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
