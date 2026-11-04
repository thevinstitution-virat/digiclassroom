# Virat Evaluator: what remains, in order (written 5 Nov 2026)

This file lists everything still open after Phases 3 and 5 reached production (code on `main` at `07db5cc`, migrations 021 to 027 applied, feature off for every institution). It does not replace `roadmap.md` (the full plan and its log); it is the working list from here. "YOU" means the owner or the people the owner arranges; "Claude" means a Claude Code session; "people" means volunteers, teachers and experts.

## 0. Where each role stands today

| Role | Built | Not built or not checked |
|---|---|---|
| Super admin | Raters, invitations, Consent, Tenants (switch, class list, rupee budget, history), Eligibility (promote, demote, history), Monitoring (alerts, automatic demotion, quota burn), Runs & gates (imported reports) | Regression results are on the Runs & gates tab (migration 029; `hw:eval:gates import-regression`). Shadow results stay command-line only (an owner rule, `eval-tools.test`). The tabs are English only. Never used on production data |
| Institution admin | AI-use card (budget, 80% warning, answer-key spend), 7-day marking-quality view, teacher-class links | Cannot change the class limit or budget (the super admin does, by design) |
| Teacher | Builder (origin, passage, answer-key states, own rubric), publish preview, marking view with stated reasons; the AI-suggestion workflow (see it, change a mark, accept with the change) walked through in English and Hindi | Bulk accept was not walked through |
| Student | Write, submit, results (existing); the question's passage; walked through in a browser (list, passage, returned result) in English and Hindi | Photo answers (D4). Fixes since the last push are not on `main` yet |
| Parent / guardian | **Rebuilt 5 Nov as platform onboarding (workstream A2, migration 030):** invitation and link tables, an institution admin's "Guardians" page (B2B), the super admin's "Guardians" page for independent learners (B2C), the public `/accept-guardian/<token>` page, a "My Wards" page, English and Hindi, 12 database tests. The written-assignments parent view now reads the same link table. Off unless `GUARDIAN_INVITES_ENABLED` (invitations) and `HW_PARENT_VIEW_ENABLED` (the assignments page) | Migration 030 is not applied on production. What a guardian sees beyond written assignments (syllabus insight, analytics) is still to build (see A2 below); the policy questions are open
| Rater (evaluator) | Queue, menu, Hindi screens | The task page was never checked in a browser |

## 1. Decisions needed from YOU (nothing below the line moves without these)

| # | Decision | Needed for | Recommendation |
|---|---|---|---|
| P1 | **Parent policy** (D10 in `roadmap.md`, "after the pilot, policy first") | Workstream A | The proposal in A1 below; Claude builds it behind a flag that is off, so deciding later costs nothing |
| D4 | Photo answers in the pilot | Workstream F | Yes: most students write on paper |
| R1 | Confirm `HW_KEY_R_MIN=0.50` and the key models on the backend are the calibrated values | Any answer key built in production | Run the calibration script on the VPS yourself (Claude is blocked from running it with the backend's secrets) |
| W1 | Schedule the job worker (a Coolify scheduled task for `/api/cron/hw-jobs` and `HW_CRON_SECRET`) | Keys, reading, marking and monitoring in production | Only once a pilot institution is ready; it is a production change |
| L1 | Legal review of the consent forms (English and Hindi) | Phase 4 with real people | YOU; Claude is not giving legal advice |

## 2. Workstreams

### A. Parent view (Claude) — BUILT 5 Nov, local, not pushed; migration 028 not applied
**Proposal for P1 (a conservative default; change it by deciding differently):**
- A parent sees **only their own linked child's returned work**: the assignment title, subject, due date, whether it was submitted and whether it was late, and, once the teacher has **returned** it, the marks per question, the teacher's comments and the total. Never an AI suggestion, a transcript, a student flag or another child's work. Nothing before the teacher returns it (the same rule as for students).
- The link is made **by the institution admin** (parent account email to student), not by the parent, so an institution knows who may see a child's work. A link can be ended at any time by the institution admin; it records who made it and when.
- Off by default (`HW_PARENT_VIEW_ENABLED`), and only for institutions where the feature is on.

Tasks: A1 migration 028 (`hw_guardian_link`, additive, rollback, rehearsal); A2 access rule and service (every function checks the link, the institution and that the work is returned); A3 institution admin screen to link and unlink; A4 parent screens (children, assignments, a returned result), English and Hindi; A5 tests for every rule (no link, ended link, wrong institution, unreturned work, another child's work, AI content never present); A6 walkthrough screenshots. **Acceptance:** a parent with no link sees nothing; a linked parent sees exactly the returned results; the tests prove it.

### A2. Guardian onboarding for B2B and B2C (Claude) — BUILT 5 Nov, local, not pushed; migration 030 not applied
Your requirement: apps work as a trio, Book Buddy is standalone; both B2B and B2C; the guardian is invited, not self-registered.
- **B2B:** the institution admin opens Guardians, picks a student of THEIR institution, types the guardian's e-mail; a bilingual e-mail carries a link (valid 14 days; the link is also shown so it can be passed on by hand if the mail fails).
- **B2C:** the super admin opens Guardians, searches for a student who joined as an independent learner (no institution, no class), picks them and types the guardian's e-mail. An institution's student can never be invited this way.
- **Accepting:** the guardian opens `/accept-guardian/<token>`, creates an account with THAT address (or signs in) and confirms the e-mail, then accepts. Only an account with the invited, verified address can accept; an existing student, teacher or admin account cannot be turned into a guardian; B2B adds a `parent` membership in the institution, B2C adds none. One guardian can have several children across schools and independent learners.
- **Safety:** the token is stored only as a hash; links and invitations are never deleted (ended or revoked, with who and when, enforced by database triggers); every step is audited; the whole thing is off until you set `GUARDIAN_INVITES_ENABLED`.
- **Trio / SSO:** the link lives in DigiClassroom's database. The other apps of the trio and Book Buddy can read it through the identity federation in a later step (they do not share this database); nothing in this step changes sign-in.
- **Open for you (my defaults in brackets):** what a guardian may see beyond written assignments (returned work only); consent from the student at 16+ (none yet); the sender address of the invitation e-mail (the platform default).
- **Apply:** `docs/hw-eval/apply-migration-030.sh` (rehearsal first, then `--apply`), then push, then set the flags only when you decide.

### B. Finish checking the screens (Claude) — student, parent, parent-link and the teacher's AI-suggestion screens DONE; only the rater task page (needs a dataset on disk) is still unchecked
B1 walkthrough of the student screens (start, write, submit, passage, result) in English and Hindi; B2 the rater task page with a seeded dataset; B3 the teacher marking view **with** an AI suggestion (accept, edit, bulk accept); B4 fix whatever it finds; B5 push the fixes. **Acceptance:** screenshots in `docs/hw-eval/screens/`, no errors, overflow or missing strings.

### C. Regression results on the Runs & gates tab (Claude) — BUILT 5 Nov, local; migration 029 not applied on production
Import the regression command's own output as a stored, append-only row and show it read-only, with a test that the screen matches `hw:eval:regression` for the same pair of runs. (Shadow results are deliberately excluded.)

### D. Hindi for the owner's tabs (Claude, optional)
The owner's Evaluation tabs are English. Add Hindi only if the owner or a co-owner will use them in Hindi.

### E. Production readiness (YOU, with Claude checking)
E1 confirm R_min (R1); E2 push the pending fixes; E3 decide when to schedule the worker (W1) and do it; E4 switch on one pilot institution on the Tenants tab only when Phase 4 has promoted at least one group; E5 first week: daily look at the Monitoring tab and the alert email.

### F. Photo answers, Phase 5P (Claude, after D4)
Phone capture per question (crop, greyscale, about 1000 px wide, EXIF removed), storage under `hw-assignments/`, a reader route for photos, replace the server's refusal. Reading paper photos is already measured in Phase 4 step 1.

### G. The pilot with real people (YOU and people; Claude prepares and analyses)
Phase 2 (content and decisions, no students): the teacher pack, the R_min labelling sheet, the consent forms reviewed (L1), the books for subjects not in the shared library. Phase 4: step 1 reading (volunteers copy texts; targets in `roadmap.md`), step 2 keys (expert audits 20%, stratified by origin: textbook, board, custom, at least 20 each per subject by medium; gate: audit error at most 2%), step 3 marking (mutation sets, two-teacher baseline, previously checked copies). Claude generates sheets, runs `read`, `e2e` and `mark` runs, reports CER, agreement, large errors and cost per page, and imports the gate report (`hw:eval:gates import`). **Output:** a gate table per group; groups that pass can be promoted on the Eligibility tab.

### H. Phase 6 to 8
Phase 6: the classroom pilot, 4 to 6 weeks, one institution, shadow mode at 0.1 to 0.2, weekly 15-minute review with the teachers, a weekly report from Claude. Phase 7: pilot report and the launch decision. Phase 8: after launch, in order of value (teacher, institution, then the parent features beyond workstream A).

## 3. Order

1. **Now (Claude):** A, B, C, push the fixes. These need no decision except P1 (built behind a flag).
2. **In parallel (YOU):** R1, L1, Phase 2 content, D4.
3. **After D4:** F.
4. **After Phase 2 and L1:** G (Phase 4), with Claude preparing and analysing.
5. **After Phase 4 promotes a group, and W1:** E3, E4, then Phase 6, 7, 8.

## 4. What is true at every step

Nothing is switched on for any institution until the owner does it on the Tenants tab. AI marking suggestions exist only for a group the owner has promoted on the Eligibility tab, for the setup running now, with a usable answer key. Claude does not push `main`, apply migrations, change production settings or schedule the worker without the owner's go-ahead for that step.
