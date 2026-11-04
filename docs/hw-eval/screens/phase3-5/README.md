# Screen walkthrough, Phases 3 to 5 (5 Nov 2026)

31 screenshots of the new screens, taken with headless Chrome driven by Playwright against the web and API apps running locally on a **scratch** PostgreSQL seeded with fake data (one institution, a super admin, an institution admin, a teacher, a student and a rater). Test credentials only; nothing touched a real service (mail and AI keys were blank or dummy). The seed (`walkthrough/seed.cjs`) and the script (`walkthrough/walk.cjs`) are kept so it can be repeated.

| Screen | Files |
|---|---|
| Super admin, Evaluation tabs | `super-admin-consent`, `-tenants` (editor open), `-eligibility` (group open), `-monitoring` (alert, one group's days), `-runs-gates` (checks open) |
| Institution admin, marking quality and usage (with the keys line and the 80% warning) | `institution-monitoring-en`, `-hi` (one group above the minimum size with figures; one below it with none) |
| Builder, every key status | `builder-all-statuses-{en,hi}`, `builder-key-{building,ready,partial,no_grounding,failed,not_available}-{en,hi}` |
| Builder, own rubric | `builder-own-rubric-{en,hi}` (the note that the question is hand-marked during the pilot) |
| Publish: what will be hand-marked and why | `publish-preview-dialog.txt` (the confirmation text the teacher sees) |
| Marking, why there is no suggestion | `marking-q1-*` (group not eligible), `marking-key-not-supported-*` (the key's service version is old), `marking-quota-reached-*` (the answer carries "AI quota reached") |
| Rater | `rater-evaluate-{en,hi}` (the `/evaluate` queue). **Not captured: an `/evaluate` task page**, which needs a dataset on disk and media; it was not seeded. |

## What the walkthrough checked, and found

Each screen was checked for console errors, server errors, horizontal overflow, raw string keys showing instead of text, and (Hindi screens) Devanagari text. The final run: **no findings**. Screens that had problems along the way, and what was done:

1. **Product bug (fixed, with a test):** the publish confirmation checked each question the way marking does, and that check queues a rebuild of a stale key, so merely opening the confirmation changed state (a "ready" key went back to "building"). Previews and listings now only look (`eligibilityOfQuestion(…, { rebuild: false })`); marking still queues the rebuild once. Test: "the publish preview only looks".
2. **Missing string (fixed):** the builder's "Type" field label was English only; it is now `tc.b.type` ("प्रकार").
3. Walkthrough-only problems, not product bugs: the marking page switches questions with a dropdown (my first run clicked text and so repeated question 1); the scratch database held hundreds of institutions left by the test suites, which made the owner's tables long (rebuilt the scratch database); a seeded rater competes for tasks with `eval-tools.test` and must be removed afterwards.

## Things worth knowing about running it locally

- The web app under `next start` redirects in a loop (the dashboard page calls its own `/api/me` over https when `NODE_ENV=production`); the walkthrough used `next dev` for the web app and `next start` for the API.
- The sign-in endpoint is rate limited; restart the API between runs.
- The institution and teacher screens need the `better-auth.active_organization` cookie; the script sets it.
- The scratch database refuses to grant `super_admin` by trigger; the seed disables that trigger **on the scratch copy only**, sets the role, and enables it again.
