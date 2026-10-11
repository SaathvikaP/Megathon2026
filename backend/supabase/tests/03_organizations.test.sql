-- Organisations: approval, join codes, tenant isolation, no privilege escalation.

select tests.create_user('root');
insert into public.platform_admins (user_id) values (tests.id('root'));
select tests.create_user('olga');   -- org admin of school A
select tests.create_user('tom');    -- teacher at school A
select tests.create_user('stu');    -- student at school A
select tests.create_user('nina');   -- org admin of NGO B
select tests.create_user('ned');    -- student at NGO B
select tests.create_user('eve');    -- unaffiliated, tries to misbehave

-- Request + approval
select tests.login('olga');
select tests.remember('orgA', public.request_organization('Sunrise Senior Secondary', 'school', 'Grade 11-12', 'Pune', null));
select tests.eq((select approval_status from public.organizations where id = tests.id('orgA')), 'pending', 'new organisations start pending');
select tests.throws($$select public.create_join_code(tests.id('orgA'), 'student', true, null, 30)$$, 'forbidden', 'admins of a pending organisation cannot create join codes');
select tests.throws($$select public.review_organization(tests.id('orgA'), 'approved', null)$$, 'forbidden', 'requesters cannot approve their own organisation');
select tests.throws($$update public.organizations set approval_status = 'approved' where id = tests.id('orgA')$$, '42501', 'approval status cannot be changed by direct update');
select tests.logout();

select tests.login('nina');
select tests.remember('orgB', public.request_organization('Shiksha Foundation', 'ngo', null, 'Delhi', null));
select tests.logout();

select tests.login('root');
select public.review_organization(tests.id('orgA'), 'approved', 'Verified by phone');
select public.review_organization(tests.id('orgB'), 'approved', null);
select tests.logout();

-- Join codes
select tests.login('olga');
select tests.throws($$select public.create_join_code(tests.id('orgA'), 'organization_admin', false, null, 30)$$, 'invalid_role', 'join codes can never grant organisation admin');
select public.create_join_code(tests.id('orgA'), 'student', true, null, 30);
select public.create_join_code(tests.id('orgA'), 'teacher', false, 1, 7);
select tests.remember('codeA_student', (select id from public.organization_join_codes where organization_id = tests.id('orgA') and role = 'student'));
select tests.remember('codeA_teacher', (select id from public.organization_join_codes where organization_id = tests.id('orgA') and role = 'teacher'));
select tests.ok((select code ~ '^[A-Z0-9]{10}$' from public.organization_join_codes where id = tests.id('codeA_student')), 'join codes are 10 random characters');
select tests.logout();

create temporary table codes as select id, code from public.organization_join_codes;
grant select on codes to authenticated;

select tests.login('stu');
select tests.eq((select count(*)::int from public.organization_join_codes), 0, 'students cannot list join codes');
select tests.eq((select membership_status from public.join_organization_with_code((select code from codes where id = tests.id('codeA_student')))), 'pending',
  'a student code that requires approval creates a pending membership');
select tests.throws($$select * from public.get_org_progress(tests.id('orgA'))$$, 'forbidden', 'students cannot read organisation progress');
select tests.logout();

select tests.login('tom');
select tests.eq((select membership_status || '/' || membership_role from public.join_organization_with_code(lower((select code from codes where id = tests.id('codeA_teacher'))))), 'approved/teacher',
  'codes are case-insensitive and a teacher code without approval joins immediately');
select tests.logout();

select tests.login('eve');
select tests.eq((select membership_status from public.join_organization_with_code((select code from codes where id = tests.id('codeA_teacher')))), 'invalid_code',
  'a code past its maximum uses stops working');
select tests.logout();

-- Teacher sees only approved members; pending student data stays private
select tests.login('tom');
select tests.eq((select count(*)::int from public.get_org_progress(tests.id('orgA')) where role = 'student'), 0, 'pending students are not visible to teachers');
select tests.throws($$select public.review_membership((select id from public.organization_memberships where user_id = tests.id('stu')), 'approved')$$, 'forbidden',
  'teachers cannot approve memberships');
select tests.logout();

select tests.login('olga');
select public.review_membership((select id from public.organization_memberships where user_id = tests.id('stu') and organization_id = tests.id('orgA')), 'approved');
select tests.throws($$select public.set_membership_role((select id from public.organization_memberships where user_id = tests.id('tom')), 'organization_admin')$$, 'forbidden',
  'organisation admins cannot create other organisation admins');
select tests.throws($$select public.review_membership((select id from public.organization_memberships where user_id = auth.uid()), 'revoked')$$, 'cannot_modify_own_membership',
  'organisation admins cannot change their own membership');
select tests.logout();

-- Student activity, then cross-tenant checks
select tests.login('stu');
select tests.remember('stu_l1', tests.start(1));
select tests.answer(tests.id('stu_l1'), 1, true);
select tests.logout();

select tests.login('tom');
select tests.eq((select total_points from public.get_org_progress(tests.id('orgA')) where user_id = tests.id('stu')), 125, 'teachers see their approved students'' real points');
select tests.ok((select count(*) from public.quiz_attempts where user_id = tests.id('stu')) = 1, 'teachers can read their students'' attempts through RLS');
select tests.eq((select count(*)::int from public.quiz_answer_keys), 0, 'teachers cannot read answer keys');
select tests.throws($$select public.set_membership_role((select id from public.organization_memberships where user_id = tests.id('tom')), 'organization_admin')$$, 'forbidden',
  'teachers cannot promote themselves');
select tests.logout();

select tests.login('nina');
select tests.throws($$select * from public.get_org_progress(tests.id('orgA'))$$, 'forbidden', 'admins of another organisation cannot read its progress');
select tests.eq((select count(*)::int from public.quiz_attempts where user_id = tests.id('stu')), 0, 'other organisations cannot see a student''s attempts');
select tests.eq((select count(*)::int from public.profiles where id = tests.id('stu')), 0, 'other organisations cannot see a student''s profile');
select tests.eq((select count(*)::int from public.organizations where id = tests.id('orgA')), 0, 'other organisations are invisible');
select tests.eq((select count(*)::int from public.organization_memberships where organization_id = tests.id('orgA')), 0, 'other organisations'' members are invisible');
select tests.eq((select count(*)::int from public.audit_log where organization_id = tests.id('orgA')), 0, 'other organisations'' audit entries are invisible');
select tests.logout();

select tests.login('olga');
select tests.ok((select count(*) from public.audit_log where organization_id = tests.id('orgA')) >= 3, 'organisation admins see their own audit trail');
select public.revoke_join_code(tests.id('codeA_student'));
select tests.logout();

select tests.login('ned');
select tests.eq((select membership_status from public.join_organization_with_code((select code from codes where id = tests.id('codeA_student')))), 'invalid_code', 'revoked codes stop working');
select tests.logout();

-- Suspending an organisation removes staff access
select tests.login('root');
select public.review_organization(tests.id('orgA'), 'suspended', null);
select tests.logout();
select tests.login('tom');
select tests.throws($$select * from public.get_org_progress(tests.id('orgA'))$$, 'forbidden', 'staff of a suspended organisation lose access to student data');
select tests.eq((select count(*)::int from public.quiz_attempts where user_id = tests.id('stu')), 0, 'suspension also hides attempts through RLS');
select tests.logout();

-- Brute-force throttle (10 failures in 15 minutes)
select tests.login('eve');
-- Eve already has 1 failure (the used-up code above); 9 more reach the limit.
select tests.eq((select count(*)::int from generate_series(1, 9) n, lateral public.join_organization_with_code('ZZZZZZZZ' || lpad(n::text, 2, '0')) r where r.membership_status = 'invalid_code'),
  9, 'invalid codes return a generic invalid_code result');
select tests.throws($$select * from public.join_organization_with_code('ABCDEFGH12')$$, 'too_many_attempts', 'join codes are throttled after 10 failures');
select tests.ok(not exists (select 1 from public.organization_memberships where user_id = auth.uid()), 'failed codes never create memberships');
select tests.logout();

select tests.login('stu');
select public.leave_organization(tests.id('orgA'));
select tests.eq((select count(*)::int from public.organization_memberships where user_id = auth.uid()), 0, 'students can leave an organisation');
select tests.logout();

select tests.login('olga');
select tests.throws($$select public.leave_organization(tests.id('orgA'))$$, 'cannot_leave', 'organisation admins cannot leave (must be removed by a platform admin)');
select tests.logout();
