-- Money Quest: seeded content, server-side grading, scoring, bonus, unlocking, replay safety.

-- Seeded content
select tests.eq((select count(*)::int from public.quizzes where is_published), 3, 'three published levels');
select tests.eq((select count(*)::int from public.quiz_questions where kind = 'core' and is_published), 15, '15 published core questions');
select tests.eq((select count(*)::int from public.quiz_questions where kind = 'practice'), 15, '15 practice variants');
select tests.eq(
  (select string_agg(n::text, ',') from generate_series(1, 15) n
   where (select count(*) from public.quiz_questions q where q.quiz_id = tests.quiz(((n - 1) / 5) + 1) and q.id = tests.q(n)) <> 1),
  null::text, 'questions 1-5, 6-10, 11-15 belong to levels 1, 2, 3');
select tests.eq(
  (select string_agg(n::text, ',') from generate_series(1, 15) n
   where (select o.option_key from public.quiz_answer_keys k join public.quiz_options o on o.id = k.correct_option_id
          where k.question_id = tests.q(n)) is distinct from tests.expected_key(n)),
  null::text, 'answer keys match the specified answers (1B 2B 3B 4A 5B 6B 7B 8C 9B 10C 11C 12B 13C 14B 15C)');
select tests.eq((select count(*)::int from public.quiz_options o join public.quiz_questions q on q.id = o.question_id where q.kind = 'core'), 60, 'four options per core question');
select tests.eq((select count(*)::int from public.remediation_comics where is_published), 0, 'no comic is published by the seed');
select tests.eq((select count(distinct question_id)::int from public.remediation_comics), 15, 'a comic script exists for every core question');

select tests.create_user('sam');
select tests.create_user('tara');
select tests.create_user('uma');

-- Locked levels
select tests.login('sam');
select tests.eq((select count(*)::int from public.get_money_quest_overview() where unlocked), 1, 'only level 1 is unlocked for a new student');
select tests.throws($$select public.start_quiz_attempt(tests.quiz(2))$$, 'level_locked', 'level 2 cannot be started before passing level 1');
select tests.throws($$select public.start_quiz_attempt(tests.quiz(3))$$, 'level_locked', 'level 3 cannot be started before passing level 2');

-- Level 1, all correct, first time
select tests.remember('sam_l1_a1', tests.start(1));
select tests.eq((public.start_quiz_attempt(tests.quiz(1)) ->> 'resumed')::boolean, true, 'starting again resumes the in-progress attempt');
select tests.eq((tests.answer(tests.id('sam_l1_a1'), 1, true) ->> 'bonus_points')::int, 25, 'first correct answer earns the 25-point bonus');
select tests.eq((public.submit_quiz_answer(tests.id('sam_l1_a1'), tests.q(1), tests.opt(1, 'A')) ->> 'replayed')::boolean, true,
  'a duplicate submission is detected as a replay');
select tests.eq((public.submit_quiz_answer(tests.id('sam_l1_a1'), tests.q(1), tests.opt(1, 'A')) ->> 'is_correct')::boolean, true,
  'a replay returns the original stored result, not a re-grade');
select tests.eq((select count(*)::int from public.quiz_attempt_answers where attempt_id = tests.id('sam_l1_a1')), 1, 'replays never create extra answers');
select tests.throws($$select public.submit_quiz_answer(tests.id('sam_l1_a1'), tests.q(2), tests.opt(3, 'A'))$$, 'invalid_option', 'an option from another question is rejected');
select tests.throws($$select public.submit_quiz_answer(tests.id('sam_l1_a1'), tests.q(6), tests.opt(6, 'A'))$$, 'invalid_question', 'a question from another level is rejected');
select tests.throws($$select public.submit_quiz_answer(tests.id('sam_l1_a1'), tests.q(2, 'p'), tests.opt(2, 'A', 'p'))$$, 'invalid_question', 'practice questions cannot be graded');
select tests.answer(tests.id('sam_l1_a1'), 2, true);
select tests.answer(tests.id('sam_l1_a1'), 3, true);
select tests.answer(tests.id('sam_l1_a1'), 4, true);
select tests.remember('dummy', gen_random_uuid());
select tests.eq((tests.answer(tests.id('sam_l1_a1'), 5, true) -> 'attempt_summary' ->> 'total_points')::int, 625, 'a perfect first attempt scores 5 x 125 = 625');
select tests.logout();

select tests.eq((select status from public.quiz_attempts where id = tests.id('sam_l1_a1')), 'completed', 'the attempt completes automatically after the last answer');
select tests.eq((select passed from public.quiz_attempts where id = tests.id('sam_l1_a1')), true, '5/5 passes the level');
select tests.eq((select base_points from public.quiz_attempts where id = tests.id('sam_l1_a1')), 500, 'base points are 100 per correct answer');

select tests.login('sam');
select tests.throws($$select public.submit_quiz_answer(tests.id('sam_l1_a1'), tests.q(9), tests.opt(9, 'A'))$$, 'attempt_closed', 'a completed attempt accepts no new answers');
select tests.eq((select unlocked from public.get_money_quest_overview() where level = 2), true, 'passing level 1 unlocks level 2');

-- Retry level 1: correct again earns base points only, total uses best per question
select tests.remember('sam_l1_a2', tests.start(1));
select tests.eq((tests.answer(tests.id('sam_l1_a2'), 1, true) ->> 'bonus_points')::int, 0, 'no bonus on a later attempt of the same question');
select tests.answer(tests.id('sam_l1_a2'), 2, false);
select tests.answer(tests.id('sam_l1_a2'), 3, true);
select tests.answer(tests.id('sam_l1_a2'), 4, true);
select tests.eq((tests.answer(tests.id('sam_l1_a2'), 5, true) -> 'attempt_summary' ->> 'total_points')::int, 400, 'retry attempt scores 4 x 100 with no bonus');
select tests.eq(tests.my_points(), 625, 'total points use the best result per question, so retries never double-count');

-- Level 2 with 3/5 correct: not passed, level 3 stays locked
select tests.remember('sam_l2_a1', tests.start(2));
select tests.answer(tests.id('sam_l2_a1'), 6, true);
select tests.answer(tests.id('sam_l2_a1'), 7, true);
select tests.answer(tests.id('sam_l2_a1'), 8, true);
select tests.remember('fb_wrong', (tests.answer(tests.id('sam_l2_a1'), 9, false) ->> 'answer_id')::uuid);
select tests.eq((tests.answer(tests.id('sam_l2_a1'), 10, false) -> 'attempt_summary' ->> 'passed')::boolean, false, '3/5 does not pass');
select tests.eq((select unlocked from public.get_money_quest_overview() where level = 3), false, 'level 3 stays locked after 3/5');
select tests.throws($$select public.start_quiz_attempt(tests.quiz(3))$$, 'level_locked', 'level 3 still cannot be started');

-- Incorrect-answer feedback
select tests.ok((select (f.feedback ->> 'practice_question_id') is not null from public.get_my_mistakes(50) f where f.question_id = tests.q(9)),
  'an incorrect answer offers the practice variant');
select tests.ok((select f.feedback -> 'comic' = 'null'::jsonb from public.get_my_mistakes(50) f where f.question_id = tests.q(9)),
  'unpublished comics are never sent to students');
select tests.ok((select (f.feedback ->> 'explanation') <> '' from public.get_my_mistakes(50) f where f.question_id = tests.q(9)),
  'feedback includes the explanation');
select tests.eq((public.check_practice_answer(tests.q(9, 'p'), tests.opt(9, 'A', 'p')) ->> 'is_correct')::boolean, true, 'practice answers are checked server-side');
select tests.eq(tests.my_points(), 625 + 375, 'practice answers do not change points');

-- Level 2 with 4/5: passes; question 9 now correct without bonus (first ever answer was wrong)
select tests.remember('sam_l2_a2', tests.start(2));
select tests.answer(tests.id('sam_l2_a2'), 6, true);
select tests.answer(tests.id('sam_l2_a2'), 7, true);
select tests.eq((tests.answer(tests.id('sam_l2_a2'), 9, true) ->> 'bonus_points')::int, 0, 'no bonus when the first ever answer was wrong');
select tests.answer(tests.id('sam_l2_a2'), 10, true);
select tests.eq((tests.answer(tests.id('sam_l2_a2'), 8, false) -> 'attempt_summary' ->> 'passed')::boolean, true, '4/5 passes the level');
select tests.eq((select unlocked from public.get_money_quest_overview() where level = 3), true, 'passing level 2 unlocks level 3');
select tests.eq(tests.my_points(), 625 + 375 + 200, 'points: L1 625 + Q6-8 375 + Q9-10 at 100 each');
select tests.eq((select string_agg(q.slug, ',' order by q.slug) from public.get_my_mistakes(50) m join public.quiz_questions q on q.id = m.question_id),
  'q02-emergency-or-temptation,q08-diversification-detective', 'mistakes list keeps only questions whose latest answer is wrong (Q9 was corrected)');
select tests.logout();

-- Isolation between students
select tests.login('tara');
select tests.throws($$select public.submit_quiz_answer(tests.id('sam_l2_a2'), tests.q(6), tests.opt(6, 'B'))$$, 'not_found', 'students cannot submit answers to another student''s attempt');
select tests.eq((select count(*)::int from public.quiz_attempts), 0, 'students cannot see another student''s attempts');
select tests.eq((select count(*)::int from public.quiz_attempt_answers), 0, 'students cannot see another student''s answers');
select tests.eq((select count(*)::int from public.student_question_progress), 0, 'students cannot see another student''s points');
select tests.throws($$update public.quiz_attempts set total_points = 9999$$, '42501', 'students cannot update attempts');
select tests.logout();

-- Perfect run of all three levels: 1,875 points
select tests.login('uma');
select tests.remember('uma_l1', tests.start(1));
select tests.answer(tests.id('uma_l1'), n, true) from generate_series(1, 5) n;
select tests.remember('uma_l2', tests.start(2));
select tests.answer(tests.id('uma_l2'), n, true) from generate_series(6, 10) n;
select tests.remember('uma_l3', tests.start(3));
select tests.answer(tests.id('uma_l3'), n, true) from generate_series(11, 15) n;
select tests.eq(tests.my_points(), 1875, 'a perfect first run of all 15 questions scores the 1,875 maximum');
select tests.eq((select sum(base_points)::int from public.quiz_attempts where user_id = auth.uid()), 1500, 'base points max out at 1,500');
select tests.eq((select count(*)::int from public.get_money_quest_overview() where passed), 3, 'all three levels passed');
select tests.logout();
