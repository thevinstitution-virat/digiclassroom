# Board-paper bank, importer and person check (design, phases 1 and 2, 8 Nov 2026)

Why: the answer-key service has a place for an **official** key (`buildKey` tries official, then passage, then textbook; scheme source
`board_scheme_key`), but nothing fills it. A board's sample paper and marking scheme are the best key there is: the marks and the value points are
the board's own. This bank holds them, checked by a person, so that later phases can offer them to InkBuddy learners and use them as official keys.

**Status: phases 1 and 2 are built and tested locally on branch `feat/board-paper-bank`. Nothing is applied to production, nothing reads the bank yet,
and nothing is pushed. No teacher has checked a row yet: the check sheet exists and works, and is waiting for a teacher.**

| Phase | What | State |
|---|---|---|
| 1 | Migration 032, bank file schema, validation, dry-run importer, draft import | done |
| 2 | Migration 033, the check sheet a teacher fills in, and the command that records the check ([phase 2](#phase-2-the-person-check)) | built; waiting for a teacher |
| 3 | Official-key lookup in `keyRuntime()` (`deps.official`), exact-match items for multiple choice, "any N" slots, drawings left out of AI marking | not started |
| 4 | Figures shown to the learner (private images); InkBuddy "CBSE paper practice" and the builder picker (EN/HI) | not started |
| 5 | Evaluation through `hw-eval-mutate` with official-reference questions; equation reading checks | not started |

## The bank file (`cbse-paper-bank/2`)

One JSON file per paper, made outside the app (the first one, CBSE Class X Science 086 sample paper 2026-27, was structured from the PDFs' text
layer plus a reading of the page images). It stays out of git (`hw-evals/` is ignored): the papers are board documents. The shape is
[`bank/schema.ts`](../../packages/core/src/lib/hw/bank/schema.ts).

- A **question** has its printed text, its printed scheme (`scheme_raw`), `marks_total`, a type, and either options plus the correct option (multiple
  choice and assertion-reason) or **parts**.
- A **part** has marks and **value points**. Every value point carries a short `quote` from the printed scheme.
- An **internal choice** is `choice: {kind, alternatives, common_text, alternatives_text}`. `option`: the whole question is A or B.
  `subpart`: a common part, then C or D. Parts say which alternative they belong to (`alternative: null` = every student answers it).
- **Figures** carry a description, labels, a confidence and `needs_person_check`; a figure may belong to one alternative (`alt`).
- A **"for visually impaired students"** version replaces a question and is its own entry.

## Checks before anything is stored (`validate.ts`)

The importer refuses a file with any problem, and prints all of them. Among them: question numbers 1..n; the questions add up to the paper's
marks (a choice counts once); for each alternative the parts add up to the question's marks; value points add up to their part; marks are on the
0.5 grid; value point ids are unique; **every quote is really in the printed scheme** (case, spaces and line breaks ignored); multiple choice has
options A-D and a correct one; options may be empty (drawn) only if a figure shows them; figure ids are `q<number>-…`; diagram-answer flags agree
with the parts; the visually impaired version adds up too.

This caught a real gap on its first run: the structured Q26 visually impaired version had alternative A only.

## What is stored (`expand.ts`, migration 032)

One row (`hw_bank_question`) is **one thing a learner can attempt**:

- A choice question becomes **one row per alternative** (A and B, or C and D with the common parts copied), all with the same `choice_group`, so a
  total never counts both. Each row carries the question's marks.
- A visually impaired version is its own row (`variant = 'vi'`), never served by default.
- A multiple-choice row stores `accepted_answers`: the letter, `(c)`, `C.`, `C)`, the option's words, and `C. words`. Drawn options accept the
  letter forms only.
- `needs_check` lists what a person must look at (an inferred mark split, a figure read with doubt, a drawn answer, a printed-scheme error,
  equations). It is not part of the content hash.
- `content_hash` covers everything a person checks and a learner sees (marks, text, options, parts, scheme, equations, figures).

Tables: `hw_bank_paper`, `hw_bank_question`, `hw_bank_figure`, `hw_bank_import` (append-only log). No `organization_id`: this is shared content, like
`hw_shared_key`. Status per row and paper: `draft` → `checked` → `published` (rows can also be `rejected`).

Database guards, not only code: a checked or published row's content (hash, marks, parts, stem, options, correct option) **cannot change**, and
a row cannot move within its paper; `checked`/`published` requires a named checker and time; a multiple-choice row must have four options and a
correct one; the import log cannot be updated or deleted (a deleted paper only blanks the log row's paper id).

## Importing

```bash
npm run hw:paper:import -w apps/api -- validate <bank.json>
npm run hw:paper:import -w apps/api -- plan     <bank.json> --kind sqp
npm run hw:paper:import -w apps/api -- import   <bank.json> --kind sqp --by "name"
```

- `validate` needs no database. `plan` reads the database and writes nothing. `import` writes **draft rows only**, in one transaction, with the
  paper row locked, and logs it.
- Idempotent: the same file again changes nothing (no log row either). A changed **draft** row is updated (version + 1, figures replaced).
- A changed **checked or published** row is a **conflict**: the import refuses, writes nothing (all or nothing), and names the rows. `--revise` sends
  those rows back to draft with a new version and no checker; that is the only way a checked row's content changes.
- Rows in the bank that the file no longer has are reported and kept, never deleted.

## What the teacher is asked to look at

`hw-evals/banks/cbse-x-science-sqp-2026-27/person-check.xlsx` lists what a teacher confirms: **29 items** (figures read with doubt, parts
whose printed total is not split over points, printed-scheme errors and extraction notes, drawn answers). After the import, 32 of 63 rows carry something in `needs_check`
(the sheet lists items; the rows add the equation read-back). The other 31 rows have nothing flagged but still need a person's OK before they count as checked.

## Tested

`bank-import.test.ts` (28 tests, no database, an invented fixture; also checks the real CBSE file when present) and `bank-import-db.test.ts` (15
tests against Postgres: draft-only import, idempotence, update, refusal and revise, orphans, a concurrent first import, every database guard).
`bank-review.test.ts` (30 tests, no database: the verdict file, every refusal, the paper's total, the sheet's embedded data cannot be broken out of) and
`bank-review-db.test.ts` (16 tests: recording, idempotence, all-or-nothing, stale hashes, fixes and rejections, a checked paper going back to draft,
two reviewers at once, the guards). The sheet was also driven in a browser: ticking, refusals, the filter, the downloaded file.
The real Class X Science paper was dry-run and imported as draft on a scratch database (39 questions → 63 rows, 80 marks), twice (second run: nothing
written), and migration 032 was rolled back with that data in place and re-applied with an identical schema.

## Phase 2: the person check

Nothing in the bank is usable until a named person has checked it against the board's PDFs. Phase 2 is the way to do that and to keep the record.

```bash
npm run hw:paper:review -w apps/api -- sheet  <bank.json> --kind sqp --out hw-evals/.../check-sheet.html   # make the sheet (reads the database)
npm run hw:paper:review -w apps/api -- status <bank.json> --kind sqp                                       # where the check stands
npm run hw:paper:review -w apps/api -- plan   <verdicts.json>                                              # what recording would do (writes nothing)
npm run hw:paper:review -w apps/api -- apply  <verdicts.json> [--by "name"]                                # record it
```

**The sheet** is one HTML file the teacher opens in a browser, offline. For each of the 63 rows it shows the question as the learner will see it (with
the marked-correct option), the figures as we read them, the marking points with the quote each rests on, and the printed scheme text. Every flagged
item is a box to tick; then the teacher picks *OK as it is*, *Needs a correction* or *Throw this one out* (the last two need a note). Choices are kept in the
browser, so a long check can be done over several sittings. *Save my verdicts* downloads the verdicts file. The sheet contains the board's paper text, so
`--out` must be under a `hw-evals/` folder (git-ignored); `--anywhere` overrides that.

**The verdicts file** (`cbse-paper-check/1`) names the paper, the reviewer, and per row: the question, the **content hash the teacher saw**, the verdict, the
flagged items confirmed (word for word) and the note.

**What `apply` does** (all or nothing; one bad verdict stops the whole file and names it):

- *OK*: the row becomes `checked`, with the reviewer's name and the time. A row with flagged items needs every one confirmed; confirming something the row
  does not list, or a verdict for content that has since changed (hash differs), is refused. The teacher must make a new sheet.
- *Needs a correction*: the row stays (or goes back to) draft and the note is logged. The correction is made in the bank file and imported again; that gives
  the row new content, a new hash and a new check. `status` lists the fixes that are waiting.
- *Throw this one out*: the row becomes `rejected`. It comes back only by being changed in the bank file and imported again.
- The same file twice records nothing the second time. Content is never touched; the database refuses it anyway.
- The **paper** becomes `checked` when every row is checked and the marks still add up to the paper's total (a choice counted once, visually impaired
  versions left out). A rejected or draft row keeps it from being checked. Importing a changed or new row sends a checked paper back to draft.

**In the database** (migration 033, one new table and two guard functions): `hw_bank_review` is an append-only log of every verdict (who checked, who
recorded it, which version and hash, which items were confirmed, the note), and a guard that lets a paper be marked checked or published only when it has rows
and all of them are checked.

**Limits to be honest about:** the reviewer's name is typed, not logged in (the command runs from the operator's terminal); the sheet shows our
reading of the figures, not the figure images, so the teacher compares with the PDF; and "checked" means a person compared the row with the board's paper,
not that the question has been tried with learners.

## Applying to production (later, and only on the owner's go)

Two scripts, in order, same method as 031: checks, backup, rehearsal on a throwaway copy, then `--apply`.

1. `docs/hw-eval/apply-migration-032.sh`: four tables and two trigger functions; alters nothing. Down script drops exactly those.
2. `docs/hw-eval/apply-migration-033.sh`: one table and two guard functions; needs 032. Down script drops exactly those; rows keep their status and checker.

## Decisions kept for later phases

- Equations in the bank are text (`plain`/`latex`); the reader and checks come in phase 5.
- "Any N of M" points become N slots in phase 3; MCQ become exact-match very-short items; diagram answers (Q26 A(i), Q39 A-IV and B-IV) are not AI-marked.
- `hw_question.total_marks` is derived by trigger on publish, which is why a choice is stored per alternative and not as one question.
