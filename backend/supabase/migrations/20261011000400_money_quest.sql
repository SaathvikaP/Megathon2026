-- Money Quest: levelled quizzes with server-side grading, scoring and unlocking.
--
-- Scoring policy (mirrored for display only in frontend/src/lib/quest/scoring.ts):
--   * correct answer            : 100 points
--   * incorrect answer          : 0 points
--   * first-attempt bonus       : +25 when a question is answered correctly the
--                                 first time the student ever answers it
--   * total earned points       : sum over questions of the best points earned
--                                 on that question (max 125 each, 1,875 overall)
--   * a level is passed with at least pass_correct_threshold correct answers
--     (4 of 5) in one attempt; passing unlocks the next published level.
-- Answer keys live in quiz_answer_keys, which students cannot read.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null,
  level smallint not null unique check (level between 1 and 20),
  description text not null default '',
  pass_correct_threshold smallint not null default 4 check (pass_correct_threshold >= 1),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  -- core questions are graded; practice questions are ungraded variants offered after a mistake
  kind text not null default 'core' check (kind in ('core', 'practice')),
  parent_question_id uuid references public.quiz_questions (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 3 and 140),
  prompt text not null check (char_length(prompt) between 10 and 2000),
  topic text not null default '',
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  concept text not null default '',
  misconception text not null default '',
  lesson_id uuid references public.lessons (id) on delete set null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'practice') = (parent_question_id is not null))
);

create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, kind, sort_order);
create index if not exists quiz_questions_parent_idx on public.quiz_questions (parent_question_id);
create index if not exists quiz_questions_lesson_idx on public.quiz_questions (lesson_id);

drop trigger if exists quiz_questions_set_updated_at on public.quiz_questions;
create trigger quiz_questions_set_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_key text not null check (option_key ~ '^[A-F]$'),
  option_text text not null check (char_length(option_text) between 1 and 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, option_key),
  unique (id, question_id)
);

create table if not exists public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_id uuid not null,
  explanation text not null check (char_length(explanation) between 10 and 2000),
  teaching_point text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  -- the correct option must belong to the same question
  foreign key (correct_option_id, question_id) references public.quiz_options (id, question_id)
);

drop trigger if exists quiz_answer_keys_set_updated_at on public.quiz_answer_keys;
create trigger quiz_answer_keys_set_updated_at
  before update on public.quiz_answer_keys
  for each row execute function public.set_updated_at();

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  attempt_number integer not null check (attempt_number >= 1),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  question_count integer not null check (question_count >= 1),
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  base_points integer not null default 0,
  bonus_points integer not null default 0,
  total_points integer not null default 0,
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, quiz_id, attempt_number)
);

create unique index if not exists quiz_attempts_one_in_progress
  on public.quiz_attempts (user_id, quiz_id) where status = 'in_progress';
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);

create table if not exists public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete restrict,
  selected_option_id uuid not null references public.quiz_options (id) on delete restrict,
  is_correct boolean not null,
  base_points integer not null default 0,
  bonus_points integer not null default 0,
  answered_at timestamptz not null default now(),
  remediation_comic_id uuid,
  remediation_viewed_at timestamptz,
  -- one answer per question per attempt: duplicate submissions cannot add points
  unique (attempt_id, question_id)
);

create index if not exists quiz_attempt_answers_user_idx on public.quiz_attempt_answers (user_id, answered_at desc);

create table if not exists public.student_question_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete restrict,
  first_answered_at timestamptz not null default now(),
  first_attempt_correct boolean not null,
  times_answered integer not null default 0,
  times_correct integer not null default 0,
  best_points integer not null default 0,
  last_answered_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.student_quiz_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  unlocked_at timestamptz,
  attempts_completed integer not null default 0,
  best_points integer not null default 0,
  best_correct integer not null default 0,
  latest_points integer,
  latest_correct integer,
  latest_completed_at timestamptz,
  passed_at timestamptz,
  primary key (user_id, quiz_id)
);

-- ---------------------------------------------------------------------------
-- Trusted logic
-- ---------------------------------------------------------------------------

create or replace function public.is_quiz_unlocked(p_user_id uuid, p_quiz_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level smallint;
  v_prev_quiz uuid;
begin
  select level into v_level from public.quizzes where id = p_quiz_id and is_published;
  if v_level is null then
    return false;
  end if;

  select id into v_prev_quiz
  from public.quizzes
  where is_published and level < v_level
  order by level desc
  limit 1;

  if v_prev_quiz is null then
    return true; -- first published level is always open
  end if;

  return exists (
    select 1 from public.student_quiz_progress
    where user_id = p_user_id and quiz_id = p_quiz_id and unlocked_at is not null
  ) or exists (
    select 1 from public.student_quiz_progress
    where user_id = p_user_id and quiz_id = v_prev_quiz and passed_at is not null
  );
end;
$$;

create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_attempt public.quiz_attempts%rowtype;
  v_count integer;
  v_next_number integer;
begin
  if not exists (select 1 from public.quizzes where id = p_quiz_id and is_published) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not public.is_quiz_unlocked(v_uid, p_quiz_id) then
    raise exception 'level_locked' using errcode = 'P0001';
  end if;

  select * into v_attempt
  from public.quiz_attempts
  where user_id = v_uid and quiz_id = p_quiz_id and status = 'in_progress';

  if v_attempt.id is not null then
    return jsonb_build_object('attempt_id', v_attempt.id, 'attempt_number', v_attempt.attempt_number,
      'question_count', v_attempt.question_count, 'resumed', true);
  end if;

  select count(*) into v_count
  from public.quiz_questions q
  where q.quiz_id = p_quiz_id and q.kind = 'core' and q.is_published
    and exists (select 1 from public.quiz_answer_keys k where k.question_id = q.id);

  if v_count = 0 then
    raise exception 'quiz_not_ready' using errcode = 'P0001';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_next_number
  from public.quiz_attempts
  where user_id = v_uid and quiz_id = p_quiz_id;

  begin
    insert into public.quiz_attempts (user_id, quiz_id, attempt_number, question_count)
    values (v_uid, p_quiz_id, v_next_number, v_count)
    returning * into v_attempt;
  exception when unique_violation then
    -- A concurrent request already started an attempt: return that one.
    select * into v_attempt
    from public.quiz_attempts
    where user_id = v_uid and quiz_id = p_quiz_id and status = 'in_progress';
    return jsonb_build_object('attempt_id', v_attempt.id, 'attempt_number', v_attempt.attempt_number,
      'question_count', v_attempt.question_count, 'resumed', true);
  end;

  insert into public.student_quiz_progress (user_id, quiz_id, unlocked_at)
  values (v_uid, p_quiz_id, now())
  on conflict (user_id, quiz_id) do update
    set unlocked_at = coalesce(public.student_quiz_progress.unlocked_at, now());

  return jsonb_build_object('attempt_id', v_attempt.id, 'attempt_number', v_attempt.attempt_number,
    'question_count', v_attempt.question_count, 'resumed', false);
end;
$$;

-- Feedback for a stored answer (internal).
create or replace function public.quiz_answer_feedback(p_answer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer public.quiz_attempt_answers%rowtype;
  v_key public.quiz_answer_keys%rowtype;
  v_comic jsonb;
  v_practice uuid;
begin
  select * into v_answer from public.quiz_attempt_answers where id = p_answer_id;
  select * into v_key from public.quiz_answer_keys where question_id = v_answer.question_id;

  if not v_answer.is_correct then
    select jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'takeaway', c.takeaway,
      'panels', c.script -> 'panels',
      'asset_path', c.asset_path,
      'alt_text', c.alt_text
    ) into v_comic
    from public.remediation_comics c
    where c.question_id = v_answer.question_id and c.is_published
    order by c.published_at desc nulls last
    limit 1;

    select q.id into v_practice
    from public.quiz_questions q
    where q.parent_question_id = v_answer.question_id and q.kind = 'practice' and q.is_published
    order by q.sort_order
    limit 1;
  end if;

  return jsonb_build_object(
    'answer_id', v_answer.id,
    'question_id', v_answer.question_id,
    'selected_option_id', v_answer.selected_option_id,
    'is_correct', v_answer.is_correct,
    'correct_option_id', v_key.correct_option_id,
    'explanation', v_key.explanation,
    'teaching_point', v_key.teaching_point,
    'base_points', v_answer.base_points,
    'bonus_points', v_answer.bonus_points,
    'comic', v_comic,
    'practice_question_id', v_practice
  );
end;
$$;

create or replace function public.finalize_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_quiz public.quizzes%rowtype;
  v_correct integer;
  v_incorrect integer;
  v_base integer;
  v_bonus integer;
  v_next public.quizzes%rowtype;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;
  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  if v_attempt.status = 'in_progress' then
    select count(*) filter (where is_correct),
           count(*) filter (where not is_correct),
           coalesce(sum(base_points), 0),
           coalesce(sum(bonus_points), 0)
      into v_correct, v_incorrect, v_base, v_bonus
    from public.quiz_attempt_answers
    where attempt_id = p_attempt_id;

    update public.quiz_attempts
    set status = 'completed',
        completed_at = now(),
        correct_count = v_correct,
        incorrect_count = v_incorrect,
        base_points = v_base,
        bonus_points = v_bonus,
        total_points = v_base + v_bonus,
        passed = v_correct >= v_quiz.pass_correct_threshold
    where id = p_attempt_id
    returning * into v_attempt;

    insert into public.student_quiz_progress as sp
      (user_id, quiz_id, unlocked_at, attempts_completed, best_points, best_correct,
       latest_points, latest_correct, latest_completed_at, passed_at)
    values
      (v_attempt.user_id, v_attempt.quiz_id, now(), 1, v_attempt.total_points, v_attempt.correct_count,
       v_attempt.total_points, v_attempt.correct_count, now(),
       case when v_attempt.passed then now() end)
    on conflict (user_id, quiz_id) do update set
      attempts_completed = sp.attempts_completed + 1,
      best_points = greatest(sp.best_points, excluded.best_points),
      best_correct = greatest(sp.best_correct, excluded.best_correct),
      latest_points = excluded.latest_points,
      latest_correct = excluded.latest_correct,
      latest_completed_at = excluded.latest_completed_at,
      passed_at = coalesce(sp.passed_at, excluded.passed_at);

    if v_attempt.passed then
      select * into v_next
      from public.quizzes
      where is_published and level > v_quiz.level
      order by level
      limit 1;

      if v_next.id is not null then
        insert into public.student_quiz_progress as sp (user_id, quiz_id, unlocked_at)
        values (v_attempt.user_id, v_next.id, now())
        on conflict (user_id, quiz_id) do update
          set unlocked_at = coalesce(sp.unlocked_at, now());
      end if;
    end if;
  elsif v_attempt.passed then
    select * into v_next
    from public.quizzes
    where is_published and level > v_quiz.level
    order by level
    limit 1;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'quiz_id', v_attempt.quiz_id,
    'level', v_quiz.level,
    'correct_count', v_attempt.correct_count,
    'incorrect_count', v_attempt.incorrect_count,
    'question_count', v_attempt.question_count,
    'base_points', v_attempt.base_points,
    'bonus_points', v_attempt.bonus_points,
    'total_points', v_attempt.total_points,
    'passed', v_attempt.passed,
    'pass_correct_threshold', v_quiz.pass_correct_threshold,
    'next_level', case when v_next.id is null then null else
      jsonb_build_object('quiz_id', v_next.id, 'level', v_next.level, 'title', v_next.title) end
  );
end;
$$;

create or replace function public.submit_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_attempt public.quiz_attempts%rowtype;
  v_question public.quiz_questions%rowtype;
  v_key public.quiz_answer_keys%rowtype;
  v_answer_id uuid;
  v_is_correct boolean;
  v_first_time boolean;
  v_base integer;
  v_bonus integer;
  v_answered integer;
  v_comic_id uuid;
  v_summary jsonb;
  v_replay boolean := false;
begin
  -- Lock the attempt so concurrent submissions are serialized.
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;
  if v_attempt.id is null or v_attempt.user_id <> v_uid then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select id into v_answer_id
  from public.quiz_attempt_answers
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if v_answer_id is not null then
    v_replay := true; -- duplicate submission: return the stored result unchanged
  else
    if v_attempt.status <> 'in_progress' then
      raise exception 'attempt_closed' using errcode = 'P0001';
    end if;

    select * into v_question from public.quiz_questions where id = p_question_id;
    if v_question.id is null
       or v_question.quiz_id <> v_attempt.quiz_id
       or v_question.kind <> 'core'
       or not v_question.is_published then
      raise exception 'invalid_question' using errcode = 'P0001';
    end if;

    if not exists (select 1 from public.quiz_options where id = p_option_id and question_id = p_question_id) then
      raise exception 'invalid_option' using errcode = 'P0001';
    end if;

    select * into v_key from public.quiz_answer_keys where question_id = p_question_id;
    if v_key.question_id is null then
      raise exception 'quiz_not_ready' using errcode = 'P0001';
    end if;

    v_is_correct := v_key.correct_option_id = p_option_id;
    v_first_time := not exists (
      select 1 from public.student_question_progress
      where user_id = v_uid and question_id = p_question_id
    );
    v_base := case when v_is_correct then 100 else 0 end;
    v_bonus := case when v_is_correct and v_first_time then 25 else 0 end;

    if not v_is_correct then
      select c.id into v_comic_id
      from public.remediation_comics c
      where c.question_id = p_question_id and c.is_published
      order by c.published_at desc nulls last
      limit 1;
    end if;

    insert into public.quiz_attempt_answers
      (attempt_id, user_id, question_id, selected_option_id, is_correct, base_points, bonus_points, remediation_comic_id)
    values
      (p_attempt_id, v_uid, p_question_id, p_option_id, v_is_correct, v_base, v_bonus, v_comic_id)
    returning id into v_answer_id;

    insert into public.student_question_progress as qp
      (user_id, question_id, first_attempt_correct, times_answered, times_correct, best_points)
    values
      (v_uid, p_question_id, v_is_correct, 1, case when v_is_correct then 1 else 0 end, v_base + v_bonus)
    on conflict (user_id, question_id) do update set
      times_answered = qp.times_answered + 1,
      times_correct = qp.times_correct + case when v_is_correct then 1 else 0 end,
      best_points = greatest(qp.best_points, excluded.best_points),
      last_answered_at = now();
  end if;

  select count(*) into v_answered from public.quiz_attempt_answers where attempt_id = p_attempt_id;

  if v_answered >= v_attempt.question_count or v_attempt.status = 'completed' then
    v_summary := public.finalize_quiz_attempt(p_attempt_id);
  end if;

  return public.quiz_answer_feedback(v_answer_id) || jsonb_build_object(
    'replayed', v_replay,
    'answered_count', v_answered,
    'question_count', v_attempt.question_count,
    'attempt_summary', v_summary
  );
end;
$$;

-- Ungraded practice question check. Never affects points or unlocking.
create or replace function public.check_practice_answer(p_question_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
  v_question public.quiz_questions%rowtype;
  v_key public.quiz_answer_keys%rowtype;
begin
  select * into v_question from public.quiz_questions where id = p_question_id;
  if v_question.id is null or v_question.kind <> 'practice' or not v_question.is_published
     or not public.is_quiz_unlocked(v_uid, v_question.quiz_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.quiz_options where id = p_option_id and question_id = p_question_id) then
    raise exception 'invalid_option' using errcode = 'P0001';
  end if;

  select * into v_key from public.quiz_answer_keys where question_id = p_question_id;
  if v_key.question_id is null then
    raise exception 'quiz_not_ready' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'is_correct', v_key.correct_option_id = p_option_id,
    'correct_option_id', v_key.correct_option_id,
    'explanation', v_key.explanation,
    'teaching_point', v_key.teaching_point
  );
end;
$$;

create or replace function public.mark_remediation_viewed(p_answer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  update public.quiz_attempt_answers
  set remediation_viewed_at = coalesce(remediation_viewed_at, now())
  where id = p_answer_id and user_id = v_uid;
end;
$$;

-- Latest answer per question that is still incorrect, with its feedback.
-- Only covers questions the student has already answered.
create or replace function public.get_my_mistakes(p_limit integer default 20)
returns table (
  answer_id uuid,
  question_id uuid,
  question_title text,
  level smallint,
  answered_at timestamptz,
  remediation_viewed_at timestamptz,
  feedback jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  return query
  with latest as (
    -- A question belongs to one quiz, so the highest attempt number is its latest answer
    -- (timestamps can tie within a transaction).
    select distinct on (a.question_id) a.id, a.question_id, a.is_correct, a.answered_at, a.remediation_viewed_at
    from public.quiz_attempt_answers a
    join public.quiz_attempts t on t.id = a.attempt_id
    where a.user_id = v_uid
    order by a.question_id, t.attempt_number desc, a.answered_at desc
  )
  select l.id, l.question_id, q.title, z.level, l.answered_at, l.remediation_viewed_at,
         public.quiz_answer_feedback(l.id)
  from latest l
  join public.quiz_questions q on q.id = l.question_id
  join public.quizzes z on z.id = q.quiz_id
  where not l.is_correct
  order by l.answered_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function public.get_money_quest_overview()
returns table (
  quiz_id uuid,
  slug text,
  title text,
  level smallint,
  description text,
  question_count integer,
  pass_correct_threshold smallint,
  unlocked boolean,
  passed boolean,
  attempts_completed integer,
  best_points integer,
  best_correct integer,
  latest_points integer,
  latest_correct integer,
  in_progress_attempt_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_active_user();
begin
  return query
  select
    q.id,
    q.slug,
    q.title,
    q.level,
    q.description,
    (select count(*)::integer from public.quiz_questions qq
      where qq.quiz_id = q.id and qq.kind = 'core' and qq.is_published),
    q.pass_correct_threshold,
    public.is_quiz_unlocked(v_uid, q.id),
    coalesce(sp.passed_at is not null, false),
    coalesce(sp.attempts_completed, 0),
    coalesce(sp.best_points, 0),
    coalesce(sp.best_correct, 0),
    sp.latest_points,
    sp.latest_correct,
    (select a.id from public.quiz_attempts a
      where a.user_id = v_uid and a.quiz_id = q.id and a.status = 'in_progress')
  from public.quizzes q
  left join public.student_quiz_progress sp on sp.quiz_id = q.id and sp.user_id = v_uid
  where q.is_published
  order by q.level;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.student_question_progress enable row level security;
alter table public.student_quiz_progress enable row level security;

revoke all on table public.quizzes from anon, authenticated;
revoke all on table public.quiz_questions from anon, authenticated;
revoke all on table public.quiz_options from anon, authenticated;
revoke all on table public.quiz_answer_keys from anon, authenticated;
revoke all on table public.quiz_attempts from anon, authenticated;
revoke all on table public.quiz_attempt_answers from anon, authenticated;
revoke all on table public.student_question_progress from anon, authenticated;
revoke all on table public.student_quiz_progress from anon, authenticated;

grant select on table public.quizzes to authenticated;
grant update (title, description, pass_correct_threshold, is_published) on table public.quizzes to authenticated;
grant select, insert, update, delete on table public.quiz_questions to authenticated;
grant select, insert, update, delete on table public.quiz_options to authenticated;
grant select, insert, update on table public.quiz_answer_keys to authenticated;
-- Attempts, answers and progress are read-only for clients; written only by the functions above.
grant select on table public.quiz_attempts to authenticated;
grant select on table public.quiz_attempt_answers to authenticated;
grant select on table public.student_question_progress to authenticated;
grant select on table public.student_quiz_progress to authenticated;

drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select to authenticated
  using (is_published or public.is_platform_admin());

drop policy if exists quizzes_update_admin on public.quizzes;
create policy quizzes_update_admin on public.quizzes for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists quiz_questions_select on public.quiz_questions;
create policy quiz_questions_select on public.quiz_questions for select to authenticated
  using (
    public.is_platform_admin()
    or (is_published and exists (select 1 from public.quizzes z where z.id = quiz_id and z.is_published))
  );

drop policy if exists quiz_questions_write_admin on public.quiz_questions;
create policy quiz_questions_write_admin on public.quiz_questions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists quiz_options_select on public.quiz_options;
create policy quiz_options_select on public.quiz_options for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.quiz_questions q
      join public.quizzes z on z.id = q.quiz_id
      where q.id = question_id and q.is_published and z.is_published
    )
  );

drop policy if exists quiz_options_write_admin on public.quiz_options;
create policy quiz_options_write_admin on public.quiz_options for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Answer keys: platform administrators only. Students receive correctness
-- through submit_quiz_answer after answering.
drop policy if exists quiz_answer_keys_admin on public.quiz_answer_keys;
create policy quiz_answer_keys_admin on public.quiz_answer_keys for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (public.can_view_student_data(user_id));

drop policy if exists quiz_attempt_answers_select on public.quiz_attempt_answers;
create policy quiz_attempt_answers_select on public.quiz_attempt_answers for select to authenticated
  using (public.can_view_student_data(user_id));

drop policy if exists student_question_progress_select on public.student_question_progress;
create policy student_question_progress_select on public.student_question_progress for select to authenticated
  using (public.can_view_student_data(user_id));

drop policy if exists student_quiz_progress_select on public.student_quiz_progress;
create policy student_quiz_progress_select on public.student_quiz_progress for select to authenticated
  using (public.can_view_student_data(user_id));

-- Function privileges
revoke execute on function public.quiz_answer_feedback(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_quiz_attempt(uuid) from public, anon, authenticated;
revoke execute on function public.is_quiz_unlocked(uuid, uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.start_quiz_attempt(uuid)',
    'public.submit_quiz_answer(uuid, uuid, uuid)',
    'public.check_practice_answer(uuid, uuid)',
    'public.mark_remediation_viewed(uuid)',
    'public.get_my_mistakes(integer)',
    'public.get_money_quest_overview()'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
