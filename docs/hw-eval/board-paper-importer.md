# Board-paper bank: importer, person check, official key, practice and evaluation (design, phases 1-5, 8 Nov 2026)

Why: the answer-key service has a place for an **official** key (`buildKey` tries official, then passage, then textbook; scheme source
`board_scheme_key`), but nothing fills it. A board's sample paper and marking scheme are the best key there is: the marks and the value points are
the board's own. This bank holds them, checked by a person, so that later phases can offer them to InkBuddy learners and use them as official keys.

**Status: phases 1 to 5 are built and tested locally on branch `feat/board-paper-bank`. Nothing is applied to production, nothing reads the bank yet,
and nothing is pushed. No teacher has checked a row yet: the check sheet exists and works, and is waiting for a teacher.**

| Phase | What | State |
|---|---|---|
| 1 | Migration 032, bank file schema, validation, dry-run importer, draft import | done |
| 2 | Migration 033, the check sheet a teacher fills in, and the command that records the check ([phase 2](#phase-2-the-person-check)) | built; waiting for a teacher |
| 3 | Official-key lookup in `keyRuntime()` (`deps.official`), exact-match plan for multiple choice, "any N" slots, drawings left out of AI marking ([phase 3](#phase-3-the-bank-as-the-official-key)) | built; nothing to find until a teacher has checked rows |
| 4 | Figure pictures (private), publishing, InkBuddy "CBSE paper practice", the builder picker (EN/HI), multiple choice marked by code ([phase 4](#phase-4-practising-from-a-paper)) | built; nothing is offered until a paper is published |
| 5 | Evaluation through `hw-eval-mutate` with official-reference questions; equation checks ([phase 5](#phase-5-evaluating-ai-marking-on-the-paper)) | built; **no live evaluation has been run** (needs a checked paper, provider keys and volunteers) |

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
Phase 3: `bank-official.test.ts` (58 tests: question numbers, multiple choice in every form, written keys, internal choices, drawings, any-N slots, and the real
paper's 63 rows), `bank-official-db.test.ts` (10: the lookup and every miss, two papers, the staleness check, the key service) and one case in `integration.test.ts`
(a board-paper question is keyed from a checked bank row, no model is called, and its key goes stale when the check is withdrawn and good again when it is given again).
Phase 4: `bank-practice.test.ts` (19: picture checks, which rows are offered, the question made from a row, multiple choice marked by code), `bank-practice-db.test.ts` (20: attaching,
publishing, what is offered, starting a question, the grader), `bank-practice-ui.test.tsx` (18: the screens rendered, Hindi and English) and one more case in `integration.test.ts` (a teacher
adds a question from the picker, it is keyed officially, and the student's payload carries the figure's signed link and nothing of the scheme).
Phase 5: `bank-eval.test.ts` (47: equation pairs including the real 14, what folds and what never does, the evaluation export, and the whole copy-read-report loop through the real dataset
and run-file code) and `bank-eval-db.test.ts` (3: every exported question, including all 28 of the real paper, finds its official key in the checked bank and the key adds up to its marks).
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

## Phase 3: the bank as the official key

The answer-key service already tried an **official** scheme first and never asks a model to write one; nothing supplied it. Now `keyRuntime()` does:
`deps.official` reads the bank. No migration and no flag: until a person has checked a row the lookup finds nothing, so nothing changes in production.

**Which row.** A board-paper question's `originRef` is `{kind, session, subjectCode, questionNo}` (optionally `board`, `classLevel`). `questionNo` is the number as
printed, with the alternative for an internal choice: `26`, `26A`, `3C`, and `-vi` for the visually impaired version (`26A-vi`). The lookup is a miss, with the
reason (`findOfficial`), and never a guess, when: the number is not a number; there is no such paper; two papers match (say the board or class); there is no such row;
the question has an internal choice and the number does not say which; the row is **not checked** (draft or rejected); every part is a drawing.

**What the key is** (`official.ts`, pure):

- **Written row**: the value points of its parts, in order, become the key, each citing nothing (an official scheme is its own source). The points add up to the
  marks the app can give.
- **"Any N of M"** (two parts in the CBSE paper: Q11 A and Q38 D) become **N slots**: the point that lists the choices is split into N points of equal marks,
  each "one of: x; y; z, a different one from the other slot". Which point holds the list is decided by rule (the only point, or the one naming most of the
  choices) and never guessed; marks that do not share out in half marks are refused. The import now refuses a bank file whose any-N part cannot be split.
- **Drawings are left out**: no model marks a drawing (Q26 A(i), Q39 A-IV and B-IV). The row reports them as `excluded`, and a question made from the row carries
  only `markableMarks` (Q26 A is 3 marks in the paper, 2 in the app). A question made with the full marks is refused by the key service ("points add up to 2,
  question is worth 3"), so the mismatch is loud. A row that is only a drawing is `hand`: nothing to key.
- **Multiple choice and assertion-reason** are `exact`: one point worth all the marks, plus the forms of the right option the learner may write and the forms of the
  wrong options. `choiceVerdict` says `right`, `wrong` or `unclear` by whole-answer match (letter, `(c)`, the option's words, `C. the words`; case, spacing,
  punctuation and Devanagari digits folded, as in the existing code marking). Two options, a sentence, anything else is `unclear` and is never guessed. Options drawn in a
  figure can only be picked by letter.

**Staying honest.** The key stores the bank row it came from and the content hash it had (`passage_hashes = {"bank:<id>": hash}`, `source_ref`). At marking time
`checkKeyForMarking` asks the bank again: a row that is no longer checked (a correction was asked for, it was rejected) or whose content changed makes the key stale
(`key_stale_book`, "the source text its key rests on changed") and a rebuild is queued. Checked again with the same content, the same key is good again. A rebuild
with the row gone from the bank falls through to the other sources, as the service always did; those are different keys, in their own eligibility group.

**Left for later:** AI marking of a `board_scheme_key` group still needs its eval gates (phase 5 builds the way to get them; none has been run). The phase 4 section says how `choiceVerdict` is now used by the grader.

## Phase 4: practising from a paper

Nothing is offered to anyone until the owner **publishes** a paper, and a published paper offers only the questions that are fair to put in front of a learner.

**The operator's steps, in order** (all commands are `npm run … -w apps/api -- …`):

1. `hw:paper:import` the bank file (draft rows).
2. `hw:paper:figure list <bank.json> --kind sqp` shows every figure and whether its picture is attached; `hw:paper:figure attach <bank.json> <figure-id> <picture>` attaches a
   crop of the board's PDF (PNG, JPEG or WebP, 40 to 4000 pixels a side, up to 3 MB; the type is read from the bytes). The picture is a private object under `hw-bank/` in R2.
   A figure shared by two alternatives is one picture, stored once per row. `attach` is all or nothing and refuses a row a person has already checked.
3. `hw:paper:review sheet …` makes the check sheet, now **with the pictures beside their words** (embedded, so it stays one offline file). A teacher checks, `apply` records it.
4. `hw:paper:review publish <bank.json> --kind sqp --by "owner"` is the go-live: the paper must be fully checked and the marks must add up; the paper and its rows become `published`
   and the act is logged with who did it. `unpublish` is the way back. A new, changed or revised row takes a published paper back to draft (the others keep their check).

**What a learner is offered** (`practice/paper-rules.ts`, `offerVerdict`): a row of a published paper that is not the visually impaired version, whose paper-side figures all have
pictures, and that the app can mark: multiple choice always (by code), a written row only when written answers of this kind can be marked (an eligible `board_scheme_key` group, or the
owner set `HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP=false`), never a row that is only a drawing. The server re-checks all of it when a question is started; the list the browser gets
has no option, answer or scheme in it.

**Starting a question** (`practice/paper.ts`): the same one-question assignment in the learner's own section as textbook practice, with origin `board_paper`, the question's words (a
multiple-choice question lists its options and asks for the letter), the marks the app can give (a drawing's marks are not counted, and the question says so), accepted answers for
multiple choice, and an `origin_ref` of `{kind, session, subjectCode, questionNo, board, classLevel, bankRowId}`. Its key is queued and is the board's own scheme (phase 3). The same
question twice opens the same attempt; the same trial, budget and attempt limits apply.

**Multiple choice is marked by code** (`grader/exact-match.ts`, `bank/official.ts`): the right option gets full marks, an option that is exactly a wrong one gets 0 (`rule:choice_wrong`, a
rule model, so no AI suggestion is made and none is paid for), anything else is unclear and goes on as any other answer. This only applies to a question whose `origin_ref.bankRowId`
names a bank row that is still checked.

**Figures on the answer screen**: a question made from a bank row shows the paper's own pictures (the scheme's figures never), each with its words as the alt text. They are short-lived
signed links (5 minutes), the same kind the marking screens use.

**The teacher's picker** (builder, "Add a question from a CBSE paper"): published papers and their questions (a teacher also sees written questions without the eligibility rule and the
visually impaired versions). The server makes the question from the bank row, so a teacher cannot attach one question's key to another question's words. This also fixes the old
free-text "board paper" fields (`paper`, `year`), which never matched what the answer-key service looks up by.

**Today's numbers for the CBSE Class X Science sample paper** (once published, with no pictures attached yet): 17 of the 20 multiple-choice questions can be offered; Q2, Q21 and Q22
wait for pictures. The 19 written questions wait for the AI check to pass its gates (phase 5), and 6 of them (Q14, 16, 28, 35, 37, 38) also need pictures. There are 11 paper-side
figures to attach: q2-fig1, q14-fig1, q16-figA, q16-figB, q21-figs, q22-fig1, q28-fig1, q28-fig2, q35-fig1, q37-fig1, q38-fig1. Nobody has cropped them yet.

**Limits to be honest about:** a picture is checked by a person only if they look at it on the sheet (the code shows it, it cannot make anyone look); a checked row's pictures are protected
in code, not by a database guard; Hindi is the interface language only (the paper's own words are English); the screens were tested by rendering them, not driven in a browser.

## Phase 5: evaluating AI marking on the paper

A written board-paper question is marked by a model against the board's own scheme, and a model may mark a group of questions only after the evaluation gates say so (roadmap 5.3).
Phase 5 builds everything that can be built before an evaluation is run. **No evaluation has been run**: it needs a checked paper in the database, provider keys and credit, and people.

**The questions** (`hw:paper:eval questions`): the written rows a model would mark (28 questions, 89 marks in the CBSE Class X Science paper: 8 very short, 8 short, 12 long),
each carrying its `officialRef`, the product's own question type (a case-based question is a long one, so the evaluation groups are the groups learners are marked in) and the marks the
app can give (a drawing is not counted). Multiple choice is not exported: it is marked by code, there is no model to evaluate. The groups are `science|very_short|en|board_scheme_key`,
`science|short|…`, `science|long|…`.

**The keys** (`hw-eval-mutate generate --questions q.json …`): a question with an `officialRef` is keyed from the **person-checked bank** (the script reads the database; run it with the
database the checked paper is in). It is never keyed by a model. A question whose row nobody has checked, or whose official key was not used, is reported as `official_not_used` and gets no
variants: a textbook key under a board label would make the report say something it did not test. The dataset items record the key as `official:<bank row>:<content hash>`. Only
`generate` changed; `run` marks against the key frozen in each item, which is the key the product reads.

**Equations** (`bank/equations.ts`, pure):

- *The bank's own pairs.* Every equation is written twice, `plain` and `latex`; the importer now flattens both to one canonical form and refuses a file where they differ. On the real paper this
  found two mistakes of mine, both fixed in the (ignored) bank file: the Q26 ethanol-to-ethene equation named its 170 C condition in one form and not the other, and Q37's parallel-resistance
  equation carried a "(parallel)" note in one form only. The other 12 agreed.
- *A read-back from handwriting.* `compareEquation` says `exact`, `equivalent` (only a way of writing: `CO₂` for `CO2`, `→` for `->`, `I²` for `I^2`, `×`, a space or nothing for a
  product, `−` for `-`, `°`, Greek letters by name) or `different`. It never folds what changes the science: case, coefficients, digits, signs, powers, the order of the equation.
- *The loop.* `hw:paper:eval equations` writes every distinct equation (14 in the CBSE paper) as a known-text dataset to be copied by hand; `hw-eval-mutate sheets` prints the copy sheets;
  `hw-eval-reference copies` brings the scanned pad copies in as ink items; a reading run reads them; `hw:paper:eval equation-report --run … --dataset …` says how many were read
  right, and lists the misses with how far off they were. The report is a measurement, not a gate: nothing yet turns it into a pass or a fail.

**The order of work for the CBSE Class X Science paper**

1. A teacher checks the paper (phase 2) so the keys exist.
2. `hw:paper:eval questions` -> `q.json`; `hw-eval-mutate generate` (with the checked database) -> a draft dataset and a review sample; a person reviews the sample; `freeze`.
3. `hw-eval-run` marking runs, five of them (a group needs five), then `hw:eval:gates import … --scheme-source board_scheme_key`. A group still needs at least 60 answers, and at least 30 answers
   **marked blind by two teachers** (the double-marking kit), before it can be eligible. Model-written variants alone can never make a group eligible.
4. A person promotes the group in the control room. Only then do the written paper questions appear for learners (or the owner sets `HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP=false`, which this
   work does not recommend).
5. The equation copy sheets and `equation-report`, any time after the paper is imported.

**Cost, as an estimate from the textbook run** (₹12.48 for keys and variants for 16 questions, ₹0.0133 per marked answer): official keys need no writer or verifier call, so about ₹10 to ₹20 for
the variants of 28 questions, and about ₹25 to ₹30 to mark roughly 400 items five times. Not measured on this paper.

**Limits to be honest about:** the variants are written by a model and have expected marks by construction, not a teacher's marks; the real handwriting, real half-right answers and the Hindi
medium are untested; the equation check cannot tell a misread from a different way of writing a different equation that happens to fold to the same string (none of the 14 do); a
product written as ` x ` between two variables is read as a multiplication sign, so an equation whose variable is called `x` should be written `mx`, not `m x`, in the bank.

## Applying to production (later, and only on the owner's go)

Phases 3 and 4 add no migration. Two scripts, in order, same method as 031: checks, backup, rehearsal on a throwaway copy, then `--apply`.

1. `docs/hw-eval/apply-migration-032.sh`: four tables and two trigger functions; alters nothing. Down script drops exactly those.
2. `docs/hw-eval/apply-migration-033.sh`: one table and two guard functions; needs 032. Down script drops exactly those; rows keep their status and checker.

## Decisions kept for later phases

- Equations in the bank are text (`plain`/`latex`); phase 5 checks the pair and compares a read-back.
- Done in phase 3: "any N of M" points are N slots, drawings are not AI-marked, multiple choice is an exact-match plan. Done in phase 4: a multiple-choice row becomes a one-mark
  very-short question with the accepted answers, marked by code (right and wrong both).
- `hw_question.total_marks` is derived by trigger on publish, which is why a choice is stored per alternative and not as one question.
