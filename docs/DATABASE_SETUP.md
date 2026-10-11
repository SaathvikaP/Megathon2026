# Database setup: shared Supabase project

The app uses the **existing** Supabase project. Do not create another project or a separate copy of the database.

| Item | Value |
| --- | --- |
| Project ref | `umewelsxflzklynuibbh` |
| API URL | `https://umewelsxflzklynuibbh.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/umewelsxflzklynuibbh |

Linking the GitHub repository to Supabase does **not** give the app its keys. Every developer configures their own `frontend/.env.local` (step 1).

Database files live in `backend/`: migrations in `backend/supabase/migrations/`, SQL tests in `backend/supabase/tests/`, the Supabase CLI config in `backend/supabase/config.toml`. Run npm scripts from the repository root.

## 1. Local environment variables

```bash
cp frontend/.env.example frontend/.env.local      # PowerShell: Copy-Item frontend/.env.example frontend/.env.local
```

In [Project Settings → API](https://supabase.com/dashboard/project/umewelsxflzklynuibbh/settings/api), copy the **anon / publishable** key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env.local` is gitignored. Next.js reads env files only from `frontend/`, and `npm run db:verify` reads the same file.

| Variable | Where it is used | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No (public project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | No. It's designed to be public; RLS protects the data |
| `NEXT_PUBLIC_SITE_URL` | Auth email redirect links | No |
| `VERIFY_EMAIL` / `VERIFY_PASSWORD` | Optional, only for `npm run db:verify` with a test account | Yes. Keep in `frontend/.env.local` only |
| `OPENAI_API_KEY` | Optional, server only: AI comic image generation (`docs/COMICS_WORKFLOW.md`) | Yes. Never in a `NEXT_PUBLIC_*` variable |
| `OPENAI_IMAGE_MODEL` | Optional, server only. Defaults to `gpt-image-1` | No |

Next.js copies `NEXT_PUBLIC_*` values into the build. After changing them, restart `npm run dev`, or run `npm run build` again before `npm run start`. Server-only variables such as `OPENAI_API_KEY` need only a restart.

The app **does not use** the service-role key or the database password. Don't add them to `.env.local`, and never put them in a `NEXT_PUBLIC_*` variable, in source code, in docs or in a commit. `frontend/src/lib/env.ts` refuses a Supabase URL that doesn't belong to this project unless `ALLOW_NON_PROJECT_SUPABASE_URL=true` is set, which guards against connecting to the wrong project by accident.

## 2. Apply the migrations (needs the project owner's approval)

The migrations in `backend/supabase/migrations/` must be applied **in filename order**:

| File | Creates |
| --- | --- |
| `20261011000100_core_identity.sql` | `profiles`, `platform_admins`, `audit_log`, sign-up trigger, role helpers |
| `20261011000200_organizations.sql` | `organizations`, `organization_join_codes`, `organization_memberships`, `join_code_failures`, membership RPCs |
| `20261011000300_learning_content.sql` | `learning_pillars`, `lessons`, `lesson_progress` |
| `20261011000400_money_quest.sql` | `quizzes`, `quiz_questions`, `quiz_options`, `quiz_answer_keys`, `quiz_attempts`, `quiz_attempt_answers`, `student_question_progress`, `student_quiz_progress`, grading/unlock RPCs |
| `20261011000500_remediation_comics.sql` | `remediation_comics`, the private Storage bucket `comic-assets` and its policies, comic review/publish RPCs |
| `20261011000600_admin_analytics_activities.sql` | `external_activities`, admin RPCs, organization progress, content audit triggers |
| `20261011000700_seed_learning_content.sql` | 4 pillars, 14 lessons, 3 quiz levels × 5 questions, 15 practice questions, 15 unpublished comic scripts waiting for review |
| `20261011000800_comic_ai_provider.sql` | Allows `openai_images` as a comic provider (replaces the `remediation_comics_provider_check` constraint; no data changes) |

They are written to be re-runnable (`create … if not exists`, `drop policy/trigger if exists` followed by `create`, and `on conflict do nothing` for seed rows). They don't drop tables or delete rows, and running them twice on a local database is part of the test suite. They do change shared state, though, so review them before applying:

- They **replace** any trigger named `on_auth_user_created` on `auth.users` with this app's version.
- They **backfill** a `profiles` row for every existing Auth user, using the part of their email before the `@` as the display name.
- If tables with the same names already exist but have different columns (for example from an earlier draft schema), `create table if not exists` skips them and later statements will fail.

### 2a. Preflight check (read-only)

Run this in the [SQL Editor](https://supabase.com/dashboard/project/umewelsxflzklynuibbh/sql) first:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by 1;

select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

select count(*) as auth_users from auth.users;
```

If `public` is empty or contains only unrelated tables, and no conflicting trigger exists, it is safe to continue. If you see tables such as `profiles`, `quizzes` or `lessons` from an earlier version, stop and decide with the team whether to migrate them. Don't drop them to make the new migrations fit.

### 2b. Apply

**Option A: SQL Editor.** Open each file in order, paste the whole file into a new query and run it. Check that each one finishes without errors before running the next.

**Option B: Supabase CLI.** Run these from `backend/`, the folder that contains `supabase/`.

```bash
cd backend
npx supabase login
npx supabase link --project-ref umewelsxflzklynuibbh
npx supabase db push --dry-run     # shows which migrations would run
npx supabase db push
```

`link` asks for the database password in your terminal. Don't save it in the repo. If the project already has migrations recorded that aren't in this folder, `db push` will refuse to run; don't use `supabase db reset` or `migration repair` without agreeing on it first.

### 2c. Confirm

- [Table Editor](https://supabase.com/dashboard/project/umewelsxflzklynuibbh/editor) lists the tables above, each with RLS enabled.
- [Storage](https://supabase.com/dashboard/project/umewelsxflzklynuibbh/storage/buckets) shows a **private** bucket called `comic-assets`.
- `npm run db:verify` prints `STEP 2 OK` and `VERIFY_OK`.

If you change files in `backend/content/` (or the pillars in `frontend/src/lib/content/pillars.mjs`), run `npm run db:seed-sql` to regenerate the seed migration. Seed rows use `on conflict do nothing`, so re-running the seed doesn't overwrite edits made in the admin CMS. Edit live content through `/admin` instead.

## 3. Create the first platform admin

Platform admins can't be created from the app. Only an existing admin can grant the role, so the first admin is created once in the SQL Editor after that person has signed up and confirmed their email:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'admin@example.org'   -- replace with the real email
on conflict do nothing;
```

After that, use **Admin → Users** in the app to grant or revoke admin rights. Every change is written to the audit log. Keep the number of platform admins small.

## 4. Auth settings

In [Authentication → URL Configuration](https://supabase.com/dashboard/project/umewelsxflzklynuibbh/auth/url-configuration):

- **Site URL**: `http://localhost:3000` for development, or the deployed URL.
- **Redirect URLs**: add `http://localhost:3000/auth/confirm` and the deployed equivalent, for example `https://your-domain/auth/confirm`.

The `/auth/confirm` route accepts both PKCE `?code=` links (the default email templates) and `?token_hash=` links. PKCE links only work in the browser where the user signed up. To make links work on any device, edit the templates under **Authentication → Email Templates**:

- Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
- Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

Supabase's built-in email sender is heavily rate-limited. Configure custom SMTP before inviting a whole class.

## 5. Roles and data access

| Role | Where it's stored | Can do |
| --- | --- | --- |
| Student | Default for every user | Read published content, play the quiz, see only their own progress |
| Teacher | `organization_memberships.role = 'teacher'` (approved) | See progress of approved members of their organization |
| Organization admin | `organization_memberships.role = 'organization_admin'` | Also approve or reject members, change student/teacher roles, manage join codes, read their organization's audit entries |
| Platform admin | Row in `platform_admins` | Everything in `/admin`: content, comics, activities, organizations, users, audit log |

- RLS is enabled on every table. The `anon` role has no table access at all.
- Students can't read `quiz_answer_keys`, can't write scores or progress, and can't change their own `account_status`.
- Join codes grant only the student or teacher role, never admin, and are rate-limited per user.
- Suspended accounts are blocked in the database (`assert_active_user`) as well as in the UI.
- Organization staff see only approved members of their own organization. Nobody sees another organization's data.

## 6. Viewing and managing data

**Supabase dashboard.** The Table Editor works for browsing, the SQL Editor for queries, Authentication for users, Storage for comic images and Logs for API, Postgres and Auth errors. Changes made in the Table Editor run as `postgres` and **bypass RLS and the app's checks**, so prefer the in-app admin pages for content and roles; they validate input and write audit entries.

Useful read-only checks:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by 1, 2;
select action, entity_type, created_at from public.audit_log order by created_at desc limit 20;
```

**Inside Cursor.** A PostgreSQL extension from Cursor's extension marketplace (for example SQLTools with its PostgreSQL driver) can connect directly:

1. In [Project Settings → Database](https://supabase.com/dashboard/project/umewelsxflzklynuibbh/settings/database), click **Connect** and copy the **Session pooler** connection details. The direct `db.<ref>.supabase.co` host needs IPv6.
2. Enter host, port, database `postgres`, user and password in the extension. Keep the password in the extension's secret storage, not in a file in this repository.
3. Use SSL.

A direct connection is a **privileged** connection: as `postgres` it bypasses RLS and can read answer keys and student data. Give database credentials only to the one or two people who manage the schema. A custom low-privilege login role still goes through RLS, and the app's policies only grant rows to `authenticated`, so such a role would see empty tables unless given broad rights. For everyone else, the dashboard Table Editor (with the right team role) or the app's admin pages are safer.

## 7. Teammate access (least privilege)

| Kind of access | Who needs it | How |
| --- | --- | --- |
| Run the app locally | Every developer | Clone the repo, create their own `frontend/.env.local` from `frontend/.env.example` with the same project URL and anon key, then `npm run db:verify` |
| Supabase dashboard | People who inspect data or apply migrations | Owner invites them under **Organization settings → Team** with the **Developer** role (or **Read-only**, if your plan offers it). Avoid Owner or Administrator |
| Platform admin in the app | Content managers | An existing admin grants it in **Admin → Users** |
| Database password / direct Postgres | One or two schema maintainers | Shared out-of-band (password manager), never in chat or Git. Rotate it in Project Settings → Database if it leaks |

Team rules:

1. Everyone uses project `umewelsxflzklynuibbh`. Don't create personal copies for shared data.
2. Schema changes go through new files in `backend/supabase/migrations/`, reviewed in a pull request. Don't edit tables by hand in the dashboard.
3. Never commit `.env.local`, the service-role key, the database password or any provider credentials. `frontend/.env.example` contains placeholders only.
4. Use test accounts with made-up names. Don't put real student data in development.

## 8. Verify the connection

```bash
npm run db:verify
```

| Output | Meaning |
| --- | --- |
| `STEP 1 OK` | Supabase Auth is reachable and the anon key was accepted |
| `STEP 2 OK` | Migrations are present, and anonymous calls are correctly refused |
| `VERIFY_PARTIAL` (exit code 2) | Connected, but migrations aren't applied yet (step 2) |
| `STEP 3 OK` | Signed in with `VERIFY_EMAIL` / `VERIFY_PASSWORD` and read the quiz overview |
| `VERIFY_FAILED` | Missing or placeholder key, wrong project URL, or network error |

The script never prints keys or passwords.
