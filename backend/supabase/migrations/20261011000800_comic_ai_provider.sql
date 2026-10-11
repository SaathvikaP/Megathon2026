-- Allows comics whose artwork was generated through an image-generation API
-- (OpenAI Images API, called server-side by a platform admin). Additive only:
-- widens the provider check constraint and touches no rows.

alter table public.remediation_comics drop constraint if exists remediation_comics_provider_check;
alter table public.remediation_comics
  add constraint remediation_comics_provider_check
  check (provider in ('comicsmaker_manual', 'comicsmaker_api', 'other_manual', 'openai_images'));
