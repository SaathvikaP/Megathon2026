-- Comic-based remediation linked to quiz questions and lessons.
-- Production workflow is manual (ComicsMaker.ai has no documented public API at the
-- time of writing): admins edit a script, create the comic on comicsmaker.ai, upload
-- the image here, review and publish. Columns for provider job ids exist so an API
-- adapter can be added later without schema changes.

create table if not exists public.remediation_comics (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.quiz_questions (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  slug text unique check (slug is null or slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '',
  topic text not null default '',
  concept text not null default '',
  misconception text not null default '',
  -- { "characters": [...], "panels": [{ "stage", "setting", "visual", "dialogue": [{ "speaker", "line" }], "caption" }] }
  script jsonb not null default '{"characters": [], "panels": []}'::jsonb check (jsonb_typeof(script) = 'object'),
  takeaway text not null default '',
  alt_text text not null default '',
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  asset_path text unique,
  asset_mime_type text check (asset_mime_type is null or asset_mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  asset_size_bytes integer check (asset_size_bytes is null or asset_size_bytes between 1 and 5242880),
  provider text not null default 'comicsmaker_manual'
    check (provider in ('comicsmaker_manual', 'comicsmaker_api', 'other_manual')),
  provider_generation_id text,
  generation_status text not null default 'script_draft'
    check (generation_status in ('script_draft', 'script_ready', 'awaiting_asset', 'generating', 'asset_uploaded', 'generation_failed')),
  generation_error text,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved', 'rejected')),
  review_note text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or review_status = 'approved'),
  check (question_id is not null or lesson_id is not null)
);

create index if not exists remediation_comics_question_idx on public.remediation_comics (question_id);
create index if not exists remediation_comics_lesson_idx on public.remediation_comics (lesson_id);
-- At most one published comic per question.
create unique index if not exists remediation_comics_one_published_per_question
  on public.remediation_comics (question_id) where is_published and question_id is not null;

drop trigger if exists remediation_comics_set_updated_at on public.remediation_comics;
create trigger remediation_comics_set_updated_at
  before update on public.remediation_comics
  for each row execute function public.set_updated_at();

-- Editing what students see sends an approved comic back to review and unpublishes it.
create or replace function public.remediation_comics_require_rereview()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.script, new.takeaway, new.alt_text, new.title, new.question_id)
     is distinct from (old.script, old.takeaway, old.alt_text, old.title, old.question_id)
     and old.review_status in ('approved', 'in_review')
     and new.review_status = old.review_status then
    new.review_status := 'in_review';
    new.is_published := false;
    new.published_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.remediation_comics_require_rereview() from public, anon, authenticated;

drop trigger if exists remediation_comics_require_rereview on public.remediation_comics;
create trigger remediation_comics_require_rereview
  before update on public.remediation_comics
  for each row execute function public.remediation_comics_require_rereview();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quiz_attempt_answers_remediation_comic_fk'
  ) then
    alter table public.quiz_attempt_answers
      add constraint quiz_attempt_answers_remediation_comic_fk
      foreign key (remediation_comic_id) references public.remediation_comics (id) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket; students may read only assets of published comics.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comic-assets', 'comic-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists comic_assets_select on storage.objects;
create policy comic_assets_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comic-assets'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.remediation_comics c
        where c.asset_path = objects.name and c.is_published
      )
    )
  );

drop policy if exists comic_assets_insert on storage.objects;
create policy comic_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comic-assets' and public.is_platform_admin());

drop policy if exists comic_assets_update on storage.objects;
create policy comic_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'comic-assets' and public.is_platform_admin())
  with check (bucket_id = 'comic-assets' and public.is_platform_admin());

drop policy if exists comic_assets_delete on storage.objects;
create policy comic_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'comic-assets' and public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- RPCs (publication state changes only through these)
-- ---------------------------------------------------------------------------

create or replace function public.review_comic(p_comic_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_platform_admin();
begin
  if p_decision not in ('draft', 'in_review', 'approved', 'rejected') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;

  update public.remediation_comics
  set review_status = p_decision,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = v_uid,
      reviewed_at = now(),
      is_published = case when p_decision = 'approved' then is_published else false end,
      published_at = case when p_decision = 'approved' then published_at else null end
  where id = p_comic_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform public.log_audit('comic.review_' || p_decision, 'remediation_comic', p_comic_id::text, null, '{}'::jsonb);
end;
$$;

create or replace function public.set_comic_published(p_comic_id uuid, p_publish boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.remediation_comics%rowtype;
  v_panels integer;
begin
  perform public.assert_platform_admin();

  select * into v_c from public.remediation_comics where id = p_comic_id for update;
  if v_c.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not p_publish then
    update public.remediation_comics set is_published = false, published_at = null where id = p_comic_id;
    perform public.log_audit('comic.unpublished', 'remediation_comic', p_comic_id::text, null, '{}'::jsonb);
    return;
  end if;

  if v_c.review_status <> 'approved' then
    raise exception 'comic_not_approved' using errcode = 'P0001';
  end if;

  v_panels := coalesce(jsonb_array_length(v_c.script -> 'panels'), 0);
  if v_c.asset_path is null and v_panels < 3 then
    raise exception 'comic_incomplete' using errcode = 'P0001';
  end if;
  if v_c.asset_path is not null and v_c.asset_path not like v_c.id::text || '/%' then
    raise exception 'asset_mismatch' using errcode = 'P0001';
  end if;
  if char_length(trim(v_c.takeaway)) = 0 then
    raise exception 'comic_incomplete' using errcode = 'P0001';
  end if;

  -- Replace any other published comic for the same question.
  if v_c.question_id is not null then
    update public.remediation_comics
    set is_published = false, published_at = null
    where question_id = v_c.question_id and is_published and id <> p_comic_id;
  end if;

  update public.remediation_comics set is_published = true, published_at = now() where id = p_comic_id;
  perform public.log_audit('comic.published', 'remediation_comic', p_comic_id::text, null,
    jsonb_build_object('question_id', v_c.question_id, 'has_asset', v_c.asset_path is not null));
end;
$$;

-- Registers an uploaded image. The object must already exist in the private bucket
-- under "<comic id>/". Replacing an asset sends the comic back to review.
create or replace function public.register_comic_asset(
  p_comic_id uuid,
  p_path text,
  p_mime_type text,
  p_size_bytes integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_path text;
begin
  perform public.assert_platform_admin();

  if p_path !~ ('^' || p_comic_id::text || '/[a-z0-9-]{8,64}\.(png|jpg|webp)$') then
    raise exception 'asset_mismatch' using errcode = 'P0001';
  end if;
  if p_mime_type not in ('image/png', 'image/jpeg', 'image/webp') then
    raise exception 'invalid_file_type' using errcode = 'P0001';
  end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 5242880 then
    raise exception 'invalid_file_size' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'comic-assets' and o.name = p_path) then
    raise exception 'asset_missing' using errcode = 'P0001';
  end if;

  select asset_path into v_old_path from public.remediation_comics where id = p_comic_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  update public.remediation_comics
  set asset_path = p_path,
      asset_mime_type = p_mime_type,
      asset_size_bytes = p_size_bytes,
      generation_status = 'asset_uploaded',
      generation_error = null,
      review_status = 'in_review',
      is_published = false,
      published_at = null
  where id = p_comic_id;

  perform public.log_audit('comic.asset_registered', 'remediation_comic', p_comic_id::text, null,
    jsonb_build_object('replaced', v_old_path is not null));

  return v_old_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.remediation_comics enable row level security;

revoke all on table public.remediation_comics from anon, authenticated;
grant select, insert, delete on table public.remediation_comics to authenticated;
grant update (
  question_id, lesson_id, slug, title, description, topic, concept, misconception,
  script, takeaway, alt_text, source_references, provider, provider_generation_id,
  generation_status, generation_error
) on table public.remediation_comics to authenticated;

drop policy if exists remediation_comics_select on public.remediation_comics;
create policy remediation_comics_select on public.remediation_comics for select to authenticated
  using (is_published or public.is_platform_admin());

drop policy if exists remediation_comics_insert_admin on public.remediation_comics;
create policy remediation_comics_insert_admin on public.remediation_comics for insert to authenticated
  with check (
    public.is_platform_admin()
    and not is_published
    and review_status = 'draft'
    and asset_path is null
  );

drop policy if exists remediation_comics_update_admin on public.remediation_comics;
create policy remediation_comics_update_admin on public.remediation_comics for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists remediation_comics_delete_admin on public.remediation_comics;
create policy remediation_comics_delete_admin on public.remediation_comics for delete to authenticated
  using (public.is_platform_admin() and not is_published);

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.review_comic(uuid, text, text)',
    'public.set_comic_published(uuid, boolean)',
    'public.register_comic_asset(uuid, text, text, integer)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
