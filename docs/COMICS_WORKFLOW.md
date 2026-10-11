# Remediation comics workflow

When a student answers a Money Quest question wrongly, the feedback panel shows the published remediation comic for that question. Each comic is five short panels: situation, misconception, discovery, explanation and takeaway. A matching practice question follows it.

## Is there a ComicsMaker.ai API?

No public, documented API was found. When this integration was built (October 2026):

- The official site (https://www.comicsmaker.ai/) describes a web studio: character creator, scene creator, page designer, speech bubbles, export and paid credit plans. It has no developer, API or documentation section.
- Independent tool listings checked through web search report "API: none listed" and "no API for automation".
- A direct fetch of the site from the development environment was blocked, so the evidence comes from search results showing the official homepage and those third-party listings.

Because of this, the app does **not** call ComicsMaker.ai. Automatic generation uses the OpenAI Images API instead (next section). It doesn't scrape the site, use private endpoints or store any ComicsMaker credentials. The integration is a **manual workflow** behind a small provider interface (`frontend/src/lib/comics/provider.ts`). If ComicsMaker.ai publishes an official API later, add a server-side `submit`/`poll` provider with the key in a server-only environment variable. The table already has `provider_generation_id`, `generation_status` and `generation_error` for that.

## AI image generation (OpenAI Images API)

Admins can also generate the artwork automatically. The comic editor's **2a. Generate the artwork with AI** button calls the documented [OpenAI Images API](https://platform.openai.com/docs/api-reference/images/create) (`POST https://api.openai.com/v1/images/generations`, model `gpt-image-1` by default) from the server.

- **Setup.** Add `OPENAI_API_KEY=<your key>` to `frontend/.env.local`, then restart the app. Optionally set `OPENAI_IMAGE_MODEL` to use another GPT Image model. The key is read only by server code (`frontend/src/lib/comics/ai-image.ts` imports `server-only`). Never put it in a `NEXT_PUBLIC_*` variable. Without a key the button is disabled and the manual workflow below still works.
- **What is sent.** Only the saved comic title, fictional characters, panel script and takeaway, plus fixed layout and safety instructions (`buildAiComicPrompt` in `frontend/src/lib/comics/ai-request.ts`). No student data is ever read or sent, and a unit test checks the prompt.
- **What happens next.** The server asks for one portrait 1024×1536 WebP page and runs the same checks as a manual upload (real file type, 5 MB limit). It stores the image in the private `comic-assets` bucket and registers it. The comic is marked `provider = openai_images` and goes back to `in_review`, so a human still has to review and publish it. AI output is never shown to students automatically.
- **Failures.** A rejected key, quota limit, safety refusal or timeout sets `generation_status = generation_failed` with a short, safe error message shown in the editor. Raw provider responses and keys are never stored or displayed. A comic stuck in `generating` for more than 5 minutes can be retried.
- **Costs and terms.** Each click is a paid API call on the key owner's OpenAI account. Check OpenAI's usage policies and your organisation's rules before publishing generated images.

Image models often garble lettering. If speech bubbles come out wrong, fix them in an image editor and upload the corrected file, or use the manual workflow.

A published comic doesn't need an image. If no image has been uploaded, students see the script rendered as text panels (`frontend/src/components/ComicStrip.tsx`), so remediation works before any artwork exists.

## Privacy rules

- Prompts sent to ComicsMaker.ai contain only the comic title, the fictional characters, the panel script and the takeaway. They come from `buildComicsMakerPrompt` in `frontend/src/lib/comics/script.ts`, which never reads student data, and a unit test checks this.
- Never paste student names, emails, scores, answers, organization names or any other personal data into ComicsMaker.ai.
- Characters are fictional (for example Aarav, Meera, Dev and their cousin Asha Didi). Don't base them on real students.
- Speech bubbles must never show a real-looking UPI PIN, OTP, card number or account number.

## Step by step (platform admin)

1. **Open the comic.** Go to `/admin/comics`. The seed adds one comic per quiz question (15 in total) with a full script, `generation_status = script_ready` and `review_status = in_review`. Use **New comic** to create additional ones.
2. **Check the script.** Edit panels, characters, takeaway and alt text in the editor. **Regenerate from question** builds a simpler starter script from the question text, a tempting wrong option and the teaching point. Editing the script, title, takeaway, alt text or linked question of an approved comic automatically sends it back to review and unpublishes it.
3. **Generate with AI, or copy the prompt.** If `OPENAI_API_KEY` is configured, click **Generate comic image** and continue at step 6 (see "AI image generation" above). Otherwise, the editor shows a ready-to-paste ComicsMaker.ai prompt for the current script.
4. **Create the art on ComicsMaker.ai.** Sign in with the team's own account, paste the prompt and generate the panels. The prompt asks for short speech bubbles spelled exactly as written. AI image tools often garble lettering, so fix any wrong text with the site's speech-bubble editor before exporting. Export the page as PNG, JPEG or WebP.
5. **Upload.** Use the upload form in the comic editor. The server checks the file's real type from its magic bytes (PNG, JPEG or WebP only) and its size (5 MB maximum). It stores the file in the private `comic-assets` bucket under a path the server chooses, then registers it. Uploading moves the comic to `asset_uploaded` and back to `in_review`.
6. **Review.** Use the checklist below. Record the decision (`approved`, `rejected` or back to `draft`) with a note. Every decision is written to the audit log.
7. **Publish.** Publishing is allowed only when the comic is approved, has a takeaway, and has either an uploaded image or at least three script panels. Publishing a comic automatically unpublishes any other published comic for the same question.
8. **Check as a student.** The editor's preview shows exactly what students will see. Students load the image through a short-lived signed URL, and only once the comic is published.

## Review checklist

- [ ] The comic teaches the concept that the question tests, and its explanation matches the correct answer.
- [ ] The misconception panel shows the *wrong* idea clearly, and a later panel corrects it.
- [ ] Numbers in the art match the script and the question (amounts, interest, totals).
- [ ] Every speech bubble matches the script word for word and is legible on a phone screen.
- [ ] No real brand logos, real people, real bank names, or anything resembling a real UPI PIN, OTP, card or account number.
- [ ] Safety messages are correct: never share a PIN or OTP, a refund never requires entering a PIN, and fraud is reported at https://cybercrime.gov.in or on helpline 1930.
- [ ] Characters and settings are respectful and inclusive, with no stereotypes.
- [ ] The alt text describes the comic for screen-reader users.
- [ ] No student data appears anywhere in the comic or prompt.
- [ ] AI-generated art: lettering matches the script, and no invented logos, faces of real people or financial details slipped in.
- [ ] Usage rights: check the team's current ComicsMaker.ai plan terms before publishing. Free-plan output may carry a watermark.

## What the database enforces

- Only platform admins can create, edit, review, upload or publish comics (RLS plus the security-definer functions `review_comic`, `set_comic_published` and `register_comic_asset`).
- Students can read only published comics, and can download an image only when its comic is published (Storage policy on `comic-assets`).
- A comic can't be published unless it is approved (table check constraint), and at most one comic per question can be published at a time (partial unique index).
- These rules are covered by `backend/supabase/tests/04_comics_lessons_activities.test.sql`.
