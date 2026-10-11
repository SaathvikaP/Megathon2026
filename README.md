# FinGuard

A financial-literacy learning platform for Indian Grade 11–12 students. Students work through short lessons in four pillars (Plan & Budget, Save & Manage, Understand Investing, Stay Financially Safe), then play **Money Quest**, a three-level quiz graded on the server. Every wrong answer leads to a short remediation comic and a practice question.

Schools and NGOs can register as organizations, invite students with join codes and see progress for their own members only. Platform admins manage content, review comics, link vetted external activities and read the audit log.

There is one sign-in page (`/login`) for everyone. After signing in, each user goes to their own home: platform admins to `/admin`, approved teachers and organization admins to `/org/[orgId]`, and students to `/dashboard`. The FinGuard logo's butterfly flies off the screen as the redirect happens. The green theme and butterfly animations use plain CSS and switch off for users who prefer reduced motion.

Remediation comic artwork can be generated with the OpenAI Images API once an `OPENAI_API_KEY` is added (server-only), or produced manually. Either way, an admin reviews it before students see it. See [`docs/COMICS_WORKFLOW.md`](docs/COMICS_WORKFLOW.md).

## Stack

- Next.js 15 (App Router, server actions), React 19, TypeScript, Tailwind CSS 3
- Supabase (Postgres, Auth, Storage) through `@supabase/ssr` cookie sessions
- The project uses the existing Supabase project `umewelsxflzklynuibbh`. Do not create another one.

## Security model (short version)

- The app only ever uses the **anon/publishable key** and the signed-in user's session. No service-role key exists anywhere in the code, so the browser can't receive one.
- Every table has row-level security. Privileged changes (grading, unlocking, joining with a code, publishing comics, granting admin) happen only inside `security definer` database functions that check the caller's role and pin `search_path`.
- Answer keys live in `quiz_answer_keys`, which only platform admins can read. Students see whether they were right only after they submit an answer.
- Scores, unlocks and progress are calculated in the database. Students can't write to score or progress columns.
- Organization staff can see only their own approved members. Join codes can never grant admin roles, and repeated bad guesses are throttled.
- Comic images are stored in a private bucket. Students can open an image only after its comic is published, through short-lived signed URLs.
- Content changes, role changes, organization reviews and comic publication are written to `audit_log`.

See [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md) for the details.

## Money Quest rules

- 3 levels × 5 questions. Each correct answer earns **100 points**. The first time a student ever answers a question correctly they also earn a **25-point bonus**.
- A student's total is the sum of their best points per question. The maximum is 1,500 base points plus 375 bonus points, so **1,875** in total. Replaying can raise a score but never adds the bonus twice.
- Getting **4 of 5** right in a level unlocks the next one. The database enforces this, so a student can't start a locked level by calling the API directly.
- Each wrong answer shows a short explanation, the remediation comic for that question if one is published, and a matching practice question (practice is not scored).

## Run locally

Requirements: Node.js 20.9 or newer (24 LTS recommended) and npm.

The repository is an npm workspace with two packages, `frontend/` and `backend/`. Run every command from the repository root. One `npm install` installs both.

```bash
npm install
cp frontend/.env.example frontend/.env.local    # PowerShell: Copy-Item frontend/.env.example frontend/.env.local
# Edit frontend/.env.local: set NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase dashboard → Project Settings → API)
npm run db:verify                               # checks the connection and whether migrations are applied
npm run dev                                     # http://localhost:3000
```

Next.js only loads env files from its own folder, so `frontend/.env.local` is the single place for local settings. `npm run db:verify` reads the same file.

If the Supabase variables are missing, the app shows a `/setup-required` page instead of crashing. Next.js copies `NEXT_PUBLIC_*` values into the build, so after editing them, restart `npm run dev`, or run `npm run build` again before `npm run start`.

Before the app can be used, the migrations in `backend/supabase/migrations/` have to be applied to the shared project, and the first platform admin has to be created. Both steps are described in [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md).

## Scripts

Root scripts forward to the matching workspace.

| Command | Package | What it does |
| --- | --- | --- |
| `npm run dev` / `build` / `start` | frontend | Next.js development server, production build and production server |
| `npm run lint`, `npm run typecheck` | frontend | ESLint and `tsc --noEmit` |
| `npm test` | both | Frontend unit tests (Vitest), then backend content and seed tests (`node --test`) |
| `npm run test:offline` | both | Frontend unit tests on Node's built-in runner (needs Node ≥ 23, no installed packages), then backend tests |
| `npm run test:db` | backend | Database tests against a **local** Postgres (see below) |
| `npm run db:verify` | backend | Connection check against the shared Supabase project. Never prints keys. |
| `npm run db:seed-sql` | backend | Regenerates `backend/supabase/migrations/20261011000700_seed_learning_content.sql` from `backend/content/*.mjs` |
| `npm run db:types` | backend | Generates TypeScript types from the hosted schema into `frontend/src/lib/supabase/` (needs the Supabase CLI and a login) |

### Database tests

`npm run test:db` creates a throwaway database named `paisa_test_*` on a **local** PostgreSQL 15+ server. It then installs a small stand-in for Supabase's `auth` and `storage` schemas (`backend/supabase/tests/_supabase_shim.sql`), applies every migration twice to prove they can be re-run, and runs `backend/supabase/tests/*.test.sql`. Each test file runs inside a transaction that is rolled back, and the script drops only the database it created.

```bash
# PowerShell example
$env:TEST_DATABASE_URL = "postgresql://postgres:<local-password>@localhost:5432/postgres"
$env:PSQL = "C:\Program Files\PostgreSQL\15\bin\psql.exe"   # if psql is not on PATH
npm run test:db
```

The runner always refuses Supabase-hosted and pooler hosts, so it can't touch the shared project. Other non-local hosts are refused unless you set `ALLOW_REMOTE_TEST_DB=true`, which is meant only for a disposable CI database.

## Project structure

```
package.json             npm workspace root; forwards scripts to frontend/ and backend/
frontend/                Next.js web app
  src/app/               Routes: auth, dashboard, learn, quest, activities, profile, org/[orgId], admin/*
                         (pages plus the server actions and route handlers that call Supabase)
  src/components/        Shared UI
  src/lib/               Supabase SSR clients, auth guards, scoring display, comic helpers, content validation
  src/middleware.ts      Session refresh
  tests/unit/            Unit tests; tests/_offline/ lets them run without node_modules
  .env.example           Template for frontend/.env.local
backend/                 Supabase backend
  supabase/migrations/   Ordered SQL migrations: schema, RLS, RPCs (grading, unlocking, joining, publishing), storage, seed
  supabase/tests/        SQL tests and the local Supabase shim
  supabase/config.toml   Supabase CLI config for project umewelsxflzklynuibbh
  content/               Lessons, quiz and practice questions, comic scripts, references (source of the seed)
  scripts/               build-seed, content validation, verify-supabase, run-db-tests
  tests/                 Content and seed consistency tests
docs/                    Database setup, content sources, comic workflow
```

Why the split looks like this: all business rules (grading, scoring, unlocking, permissions) run in Postgres, so the backend is the Supabase database defined in `backend/`. The Next.js server actions in `frontend/src/app/**/actions.ts` are thin, authenticated calls into those database functions. They run inside the Next.js server, so they stay with the app. Two small plain-JavaScript modules in `frontend/src/lib/content/` (`pillars.mjs`, `validate-blocks.mjs`) are also used by the backend seed scripts, which import them directly.

## More documentation

- [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md): applying migrations, the first admin, Auth settings, teammate access, Cursor Postgres extension
- [`docs/COMICS_WORKFLOW.md`](docs/COMICS_WORKFLOW.md): how remediation comics are produced (OpenAI Images API or ComicsMaker.ai) and reviewed
- [`docs/CONTENT_SOURCES.md`](docs/CONTENT_SOURCES.md): where the learning content comes from and what still needs expert review
