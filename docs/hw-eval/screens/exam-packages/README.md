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
