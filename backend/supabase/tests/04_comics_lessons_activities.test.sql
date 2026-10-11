-- Comics review/publish workflow, Storage policies, lesson progress and external activities.

select tests.create_user('root');
insert into public.platform_admins (user_id) values (tests.id('root'));
select tests.create_user('stu');
select tests.remember('comic9', (select id from public.remediation_comics where question_id = tests.q(9)));

-- Drafts are private
select tests.login('stu');
select tests.eq((select count(*)::int from public.remediation_comics), 0, 'students cannot see unpublished comics');
select tests.throws($$select public.review_comic(tests.id('comic9'), 'approved', null)$$, 'forbidden', 'students cannot review comics');
select tests.throws($$select public.set_comic_published(tests.id('comic9'), true)$$, 'forbidden', 'students cannot publish comics');
select tests.throws($$update public.remediation_comics set is_published = true$$, '42501', 'publication cannot be set by direct update');
select tests.logout();

-- Publishing requires approval and a complete script
select tests.login('root');
select tests.throws($$select public.set_comic_published(tests.id('comic9'), true)$$, 'comic_not_approved', 'unapproved comics cannot be published');
select tests.throws($$update public.remediation_comics set review_status = 'approved' where id = tests.id('comic9')$$, '42501', 'review status cannot be set by direct update');
update public.remediation_comics set provider = 'openai_images' where id = tests.id('comic9');
select tests.eq((select provider from public.remediation_comics where id = tests.id('comic9')), 'openai_images', 'AI-generated comics can record their provider');
select tests.throws($$update public.remediation_comics set provider = 'unknown_tool' where id = tests.id('comic9')$$, 'remediation_comics_provider_check', 'unknown providers are rejected');
select public.review_comic(tests.id('comic9'), 'approved', 'Accurate and age-appropriate');
select public.set_comic_published(tests.id('comic9'), true);
select tests.eq((select is_published from public.remediation_comics where id = tests.id('comic9')), true, 'approved comics can be published');
select tests.logout();

select tests.login('stu');
select tests.eq((select count(*)::int from public.remediation_comics), 1, 'students can read published comics');
select tests.logout();

-- Comic appears in feedback for a wrong answer (student must unlock level 2 first)
select tests.login('stu');
select tests.remember('stu_l1', tests.start(1));
select tests.answer(tests.id('stu_l1'), n, true) from generate_series(1, 5) n;
select tests.remember('stu_l2', tests.start(2));
select tests.remember('fb', (tests.answer(tests.id('stu_l2'), 9, false) -> 'comic' ->> 'id')::uuid);
select tests.eq(tests.id('fb'), tests.id('comic9'), 'the published comic is returned with incorrect-answer feedback');
select tests.ok((select remediation_comic_id = tests.id('comic9') from public.quiz_attempt_answers where attempt_id = tests.id('stu_l2') and question_id = tests.q(9)),
  'the answer records which comic was shown');
select public.mark_remediation_viewed((select id from public.quiz_attempt_answers where attempt_id = tests.id('stu_l2') and question_id = tests.q(9)));
select tests.ok((select remediation_viewed_at is not null from public.quiz_attempt_answers where attempt_id = tests.id('stu_l2') and question_id = tests.q(9)),
  'viewing the comic is recorded');
select tests.eq((tests.answer(tests.id('stu_l2'), 6, true) -> 'comic'), 'null'::jsonb, 'correct answers do not include a comic');
select tests.logout();

-- Editing an approved comic sends it back to review and unpublishes it
select tests.login('root');
update public.remediation_comics set takeaway = takeaway || ' (edited)' where id = tests.id('comic9');
select tests.eq((select review_status || '/' || is_published::text from public.remediation_comics where id = tests.id('comic9')), 'in_review/false',
  'editing what students see sends a published comic back to review');
select tests.logout();

select tests.login('stu');
select tests.eq((select count(*)::int from public.remediation_comics), 0, 'the edited comic is hidden from students until re-approved');
select tests.logout();

-- Storage: only admins upload; students read only published assets
select tests.login('stu');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('comic-assets', tests.id('comic9')::text || '/aaaaaaaa.png')$$, 'row-level security',
  'students cannot upload comic files');
select tests.logout();

select tests.login('root');
insert into storage.objects (bucket_id, name) values ('comic-assets', tests.id('comic9')::text || '/0f0e0d0c-1111-2222-3333-444455556666.png');
select tests.throws($$select public.register_comic_asset(tests.id('comic9'), 'other/0f0e0d0c-1111.png', 'image/png', 1000)$$, 'asset_mismatch', 'assets must live under the comic''s own folder');
select tests.throws($$select public.register_comic_asset(tests.id('comic9'), tests.id('comic9')::text || '/../../etc.png', 'image/png', 1000)$$, 'asset_mismatch', 'path traversal in asset paths is rejected');
select tests.throws($$select public.register_comic_asset(tests.id('comic9'), tests.id('comic9')::text || '/9999999999.png', 'image/png', 1000)$$, 'asset_missing', 'assets must exist in storage');
select tests.throws($$select public.register_comic_asset(tests.id('comic9'), tests.id('comic9')::text || '/0f0e0d0c-1111-2222-3333-444455556666.png', 'image/gif', 1000)$$, 'invalid_file_type', 'only PNG, JPEG or WebP are accepted');
select tests.throws($$select public.register_comic_asset(tests.id('comic9'), tests.id('comic9')::text || '/0f0e0d0c-1111-2222-3333-444455556666.png', 'image/png', 6000000)$$, 'invalid_file_size', 'files over 5 MB are rejected');
select public.register_comic_asset(tests.id('comic9'), tests.id('comic9')::text || '/0f0e0d0c-1111-2222-3333-444455556666.png', 'image/png', 1000);
select tests.eq((select generation_status || '/' || review_status from public.remediation_comics where id = tests.id('comic9')), 'asset_uploaded/in_review', 'uploading an image requires a new review');
select tests.logout();

select tests.login('stu');
select tests.eq((select count(*)::int from storage.objects where bucket_id = 'comic-assets'), 0, 'students cannot read assets of unpublished comics');
select tests.logout();

select tests.login('root');
select public.review_comic(tests.id('comic9'), 'approved', null);
select public.set_comic_published(tests.id('comic9'), true);
select tests.logout();

select tests.login('stu');
select tests.eq((select count(*)::int from storage.objects where bucket_id = 'comic-assets'), 1, 'students can read the asset of a published comic');
select tests.logout();

-- Lessons
select tests.remember('lesson1', (select id from public.lessons where slug = 'money-in-money-out'));
select tests.login('stu');
select public.start_lesson(tests.id('lesson1'));
select tests.eq((select status from public.lesson_progress where lesson_id = tests.id('lesson1') and user_id = auth.uid()), 'in_progress', 'opening a lesson never marks it complete');
select public.complete_lesson(tests.id('lesson1'));
select tests.eq((select status from public.lesson_progress where lesson_id = tests.id('lesson1') and user_id = auth.uid()), 'completed', 'students complete lessons explicitly');
select tests.eq((select count(*)::int from public.lessons), 14, 'the 14 seeded lessons are visible to students');
select tests.eq((select count(distinct pillar_id)::int from public.lessons), 4, 'lessons cover all four pillars');
select tests.logout();

select tests.login('root');
update public.lessons set is_published = false where id = tests.id('lesson1');
select tests.ok((select count(*) from public.audit_log where entity_type = 'lessons' and details ->> 'is_published' = 'false') = 1, 'unpublishing a lesson is audited');
select tests.throws($$delete from public.lessons where id = tests.id('lesson1')$$, '23503', 'lessons with student progress cannot be deleted');
select tests.logout();

select tests.login('stu');
select tests.throws($$select public.start_lesson(tests.id('lesson1'))$$, 'not_found', 'unpublished lessons cannot be started');
select tests.eq((select count(*)::int from public.lessons where id = tests.id('lesson1')), 0, 'unpublished lessons are hidden from students');
select tests.logout();

-- External activities
select tests.login('root');
select tests.throws($$insert into public.external_activities (title, url) values ('Insecure link', 'http://example.org/game')$$, 'external_activities_url_check', 'activity links must use https');
select tests.throws($$insert into public.external_activities (title, url) values ('Script link', 'javascript:alert(1)')$$, 'external_activities_url_check', 'javascript: links are rejected');
insert into public.external_activities (title, url, is_published) values ('Draft activity', 'https://example.org/draft', false);
select tests.logout();

select tests.login('stu');
select tests.eq((select count(*)::int from public.external_activities), 0, 'students cannot see unpublished activities');
select tests.throws($$insert into public.external_activities (title, url, is_published) values ('Mine', 'https://example.org', true)$$, 'row-level security', 'students cannot add activities');
select tests.logout();
