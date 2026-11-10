# Exam-package builder: looking at the screens locally (11 Nov 2026)

Super admin only, under **Content & Knowledge → Exam Packages** (`/dashboard/super-admin/exams`).

1. Scratch database at migration 034 (`dcp-hw-p5-pg`, port 55436).
2. `node docs/hw-eval/screens/exam-packages/seed.cjs` — one test-only super admin, `wt-sa@walkthrough.test`, with the
   throwaway password from the seed file (the same one the phase 3-5 walkthrough uses).
3. A published board paper for the pickers: import, check and publish the fixture paper the way
   `apps/web/src/__tests__/hw/exams-builder-db.test.ts` does (`publishedPaper()`), with subject code `SEED-086`.
4. Run the API (`apps/api`, port 3002) and the web app (`apps/web`, port 3003) with
   `DATABASE_URL=postgres://postgres:scratch@localhost:55436/digiclassroom`; sign in at `http://localhost:3003/sign-in`.

## What was walked through, and found

Created a package; turned the published fixture paper into a set (6 rows, 10 of 10 marks, internal choices
labelled); tagged a chapter; published the set (editing controls disappear, marks and time lock); created a
4-mark mock; wrote a 3-mark short answer (the live check refused points adding to 2 of 3 until fixed);
publish refused at 3 of 4 marks with a plain sentence; added a 1-mark multiple choice; published the set and
the package (attempts per set then locked); granted to an unknown email (refused: "No account has that
email."). No console errors besides that deliberate 404; no sideways scroll at 375 px.

Fixed during the walk: the auto short name repeated board/class/year (now from the title only); "Sec A"
wrapped in the number column; "1 questions"; the write-a-question form stayed open after publishing; the
right-answer radios had no accessible name; the grant email label wrapped and misaligned the row. Added: a
warning on a draft set listing the questions with no chapter, because chapters cannot be added after
publishing and the report's weak areas are by chapter.

## Phase 3: the learner side (same day)

Run the API with `HW_EXAMS_ENABLED=true` (the `dcp-exams-api` launch entry sets it). The seed also makes
`wt-learner@walkthrough.test` (no institution, a finished profile so the first-run wizard stays away);
grant the package to that email from the package page, then sign in as the learner.

Walked: the catalogue (package "In your plan"); the package page; the start warning; the timed paper (the
clock counts from the server, stays pinned while scrolling, the internal choices show "OR"); shifting the
device clock 30 minutes did not move the countdown; reloading resumed the same clock; "I have finished
writing" → upload window countdown and the "uploading opens in the next update" note; the package page in
Hindi with the way back to the open test; giving up → "not completed", attempt 2 offered; 375 px without
sideways scroll.

Found and fixed: **every correlated count was wrong** — drizzle renders `${table.column}` bare inside a
select's `sql```, and Postgres bound the bare `"id"` to the subquery's own table: sets per package (super
admin list), questions per test (learner), and accepted pages per attempt, which would have abandoned
attempts that had pages. Outer columns are now written in full, and tests assert each count. Also: the
countdown read the device clock between refreshes (now `performance.now()`); the clock bar slid under the
dashboard's sticky header (now placed below it, measured); a badge inside a paragraph (hydration warning).

## Phase 4: the photo booklet (same day)

The `dcp-exams-api` launch entry also sets `HW_DEV_LOCAL_STORAGE_DIR=H:\Trio\dev-storage`, so pages are
kept on disk instead of R2. Photos were fed to the "Choose photos" picker from the page itself (canvas
drawings of ruled pages with handwriting-style text, one of them blurred), since the browser pane has no
file dialog.

Walked: two sharp pages uploaded straight away; the blurred page held back with "This photo looks
blurred" and kept with "Use it anyway" (marked "Kept although it looked blurred"); moving a page up;
removing a page (its file deleted from storage — checked on disk); "Hand in 2 pages" → "Your booklet is
handed in: 2 pages", every control gone; the stored rows match the files (1500x2000 JPEGs, about
140-320 KB); 375 px without sideways scroll. No new findings.

