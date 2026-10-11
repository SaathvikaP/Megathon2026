-- Security posture: RLS everywhere, anonymous role locked out, privileged columns protected.

select tests.ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  'every table in public has row level security enabled'
);

select tests.ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
           or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))
  ),
  'the anon role has no table privileges in public'
);

select tests.eq(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  null::text,
  'the anon role cannot execute any non-trigger function in public'
);

select tests.eq(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('log_audit', 'quiz_answer_feedback', 'finalize_quiz_attempt', 'is_quiz_unlocked', 'generate_join_code', 'handle_new_user', 'audit_content_change')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  null::text,
  'internal functions are not executable by signed-in users'
);

select tests.ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)
  ),
  'every security definer function pins search_path'
);

-- Users
select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('root');
insert into public.platform_admins (user_id) values (tests.id('root'));

select tests.eq((select display_name from public.profiles where id = tests.id('alice')), 'Alice', 'sign-up trigger creates a profile from metadata');

-- Anonymous visitor
select tests.login_anon();
select tests.throws('select count(*) from public.lessons', '42501', 'anonymous users cannot read lessons');
select tests.throws('select public.get_money_quest_overview()', '42501', 'anonymous users cannot call Money Quest functions');
select tests.logout();

-- Signed-in student
select tests.login('alice');
select tests.eq((select count(*)::int from public.quiz_answer_keys), 0, 'students cannot read any answer keys');
select tests.throws($$insert into public.quiz_answer_keys (question_id, correct_option_id, explanation)
  select q.id, o.id, 'tampering attempt here' from public.quiz_questions q join public.quiz_options o on o.question_id = q.id limit 1$$,
  'row-level security', 'students cannot write answer keys');
select tests.ok((select count(*) from public.profiles) = 1, 'students see only their own profile');
select tests.throws($$update public.profiles set account_status = 'active' where id = auth.uid()$$, '42501', 'students cannot change their account status');
select tests.throws($$insert into public.platform_admins (user_id) values (auth.uid())$$, '42501', 'students cannot make themselves platform admins');
select tests.throws($$insert into public.quiz_attempts (user_id, quiz_id, attempt_number, question_count, total_points)
  select auth.uid(), id, 99, 5, 1875 from public.quizzes limit 1$$, '42501', 'students cannot insert quiz attempts directly');
select tests.throws($$insert into public.student_question_progress (user_id, question_id, first_attempt_correct, best_points)
  select auth.uid(), id, true, 125 from public.quiz_questions limit 1$$, '42501', 'students cannot write their own points');
select tests.throws($$insert into public.lesson_progress (user_id, lesson_id, status) select auth.uid(), id, 'completed' from public.lessons limit 1$$,
  '42501', 'students cannot write lesson progress directly');
update public.profiles set display_name = 'Alice K', grade_level = 11 where id = auth.uid();
select tests.eq((select display_name from public.profiles where id = auth.uid()), 'Alice K', 'students can edit their own display name');
update public.profiles set display_name = 'hacked' where id = tests.id('bob');
select tests.logout();
select tests.eq((select display_name from public.profiles where id = tests.id('bob')), 'Bob', 'students cannot edit other profiles');

select tests.login('alice');
select tests.eq((select count(*)::int from public.audit_log), 0, 'students cannot read the audit log');
select tests.throws($$select public.admin_list_users(null, 10, 0)$$, 'forbidden', 'students cannot list users');
select tests.throws($$select public.get_platform_stats()$$, 'forbidden', 'students cannot read platform statistics');
select tests.throws($$select public.admin_set_platform_admin(auth.uid(), true)$$, 'forbidden', 'students cannot grant platform admin');
select tests.logout();

-- Platform admin
select tests.login('root');
select tests.ok((select count(*) from public.quiz_answer_keys) = 30, 'platform admins can read answer keys');
select tests.ok((select (public.get_platform_stats() ->> 'users')::int) = 3, 'platform stats count real users');
select tests.throws($$select public.admin_set_platform_admin(auth.uid(), false)$$, 'last_platform_admin', 'the last platform admin cannot be removed');
select tests.throws($$select public.admin_set_account_status(auth.uid(), 'suspended')$$, 'cannot_modify_self', 'admins cannot suspend themselves');
select public.admin_set_account_status(tests.id('bob'), 'suspended');
select tests.logout();

select tests.login('bob');
select tests.throws($$select public.get_money_quest_overview()$$, 'account_suspended', 'suspended users cannot use Money Quest');
select tests.logout();

select tests.ok(exists (select 1 from public.audit_log where action = 'user.status_suspended' and actor_id = tests.id('root')), 'suspension is written to the audit log');
