-- TEST-ONLY helpers (assertions and identity switching). Loaded after the migrations.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create table if not exists tests.ids (name text primary key, id uuid not null);
grant select, insert, update on tests.ids to anon, authenticated;

create or replace function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;

create or replace function tests.remember(p_name text, p_id uuid) returns uuid language sql as $$
  insert into tests.ids (name, id) values (p_name, p_id)
  on conflict (name) do update set id = excluded.id
  returning id;
$$;

-- Creates an auth user (the on_auth_user_created trigger creates the profile).
create or replace function tests.create_user(p_name text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values (p_name || '@example.test', jsonb_build_object('display_name', initcap(p_name)))
  returning id into v_id;
  perform tests.remember(p_name, v_id);
  return v_id;
end;
$$;

-- Act as a signed-in user (same mechanism PostgREST uses: role + JWT sub claim).
create or replace function tests.login(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', tests.id(p_name)::text, false);
  perform set_config('role', 'authenticated', false);
end;
$$;

create or replace function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'anon', false);
end;
$$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

-- Money Quest helpers. n = question number 1..15 (core, slug qNN-...) ; practice uses pNN-...
create or replace function tests.q(p_n int, p_prefix text default 'q') returns uuid language sql stable as $$
  select id from public.quiz_questions where slug like p_prefix || lpad(p_n::text, 2, '0') || '-%';
$$;

create or replace function tests.opt(p_n int, p_key text, p_prefix text default 'q') returns uuid language sql stable as $$
  select o.id from public.quiz_options o where o.question_id = tests.q(p_n, p_prefix) and o.option_key = p_key;
$$;

create or replace function tests.quiz(p_level int) returns uuid language sql stable as $$
  select id from public.quizzes where level = p_level;
$$;

-- The specified answer key for the 15 core questions.
create or replace function tests.expected_key(p_n int) returns text language sql immutable as $$
  select (array['B','B','B','A','B','B','B','C','B','C','C','B','C','B','C'])[p_n];
$$;

create or replace function tests.wrong_key(p_n int) returns text language sql immutable as $$
  select case when tests.expected_key(p_n) = 'A' then 'D' else 'A' end;
$$;

create or replace function tests.answer(p_attempt uuid, p_n int, p_correct boolean) returns jsonb language sql as $$
  select public.submit_quiz_answer(p_attempt, tests.q(p_n),
    tests.opt(p_n, case when p_correct then tests.expected_key(p_n) else tests.wrong_key(p_n) end));
$$;

create or replace function tests.start(p_level int) returns uuid language sql as $$
  select (public.start_quiz_attempt(tests.quiz(p_level)) ->> 'attempt_id')::uuid;
$$;

create or replace function tests.my_points() returns int language sql stable as $$
  select coalesce(sum(best_points), 0)::int from public.student_question_progress where user_id = auth.uid();
$$;

grant execute on all functions in schema tests to anon, authenticated;

create or replace function tests.ok(p_condition boolean, p_description text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then
    raise exception 'not ok - %', p_description;
  end if;
  raise notice 'ok - %', p_description;
end;
$$;

create or replace function tests.eq(p_actual anyelement, p_expected anyelement, p_description text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'not ok - % (expected %, got %)', p_description, p_expected, p_actual;
  end if;
  raise notice 'ok - %', p_description;
end;
$$;

-- Runs p_sql as the current role and asserts it fails with a message or SQLSTATE matching p_expected.
create or replace function tests.throws(p_sql text, p_expected text, p_description text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_expected || '%' or sqlstate = p_expected then
      raise notice 'ok - %', p_description;
      return;
    end if;
    raise exception 'not ok - % (expected error "%", got [%] %)', p_description, p_expected, sqlstate, sqlerrm;
  end;
  raise exception 'not ok - % (expected error "%", but the statement succeeded)', p_description, p_expected;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
