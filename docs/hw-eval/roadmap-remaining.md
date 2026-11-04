# Virat Evaluator: what remains, in order (written 5 Nov 2026)

This file lists everything still open after Phases 3 and 5 reached production (code on `main` at `07db5cc`, migrations 021 to 027 applied, feature off for every institution). It does not replace `roadmap.md` (the full plan and its log); it is the working list from here. "YOU" means the owner or the people the owner arranges; "Claude" means a Claude Code session; "people" means volunteers, teachers and experts.

## 0. Where each role stands today

| Role | Built | Not built or not checked |
|---|---|---|
| Super admin | Raters, invitations, Consent, Tenants (switch, class list, rupee budget, history), Eligibility (promote, demote, history), Monitoring (alerts, automatic demotion, quota burn), Runs & gates (imported reports) | Regression results are on the Runs & gates tab (migration 029; `hw:eval:gates import-regression`). Shadow results stay command-line only (an owner rule, `eval-tools.test`). The tabs are English only. Never used on production data |
| Institution admin | AI-use card (budget, 80% warning, answer-key spend), 7-day marking-quality view, teacher-class links | Cannot change the class limit or budget (the super admin does, by design) |
| Teacher | Builder (origin, passage, answer-key states, own rubric), publish preview, marking view with stated reasons; the AI-suggestion workflow (see it, change a mark, accept with the change) walked through in English and Hindi | Bulk accept was not walked through |
| Student | Write, submit, results (existing); the question's passage; walked through in a browser (list, passage, returned result) in English and Hindi | Photo answers (D4). Fixes since the last push are not on `main` yet |
| Parent / guardian | **Built 5 Nov (workstream A):** migration 028 (link table), a parent page (children, assignments, a returned result), the institution admin's link screen, English and Hindi, tests for every rule. Off unless `HW_PARENT_VIEW_ENABLED` | The policy (P1) is a proposal until you decide; migration 028 is not applied on production; the page lives in the parent portal's navigation |
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
