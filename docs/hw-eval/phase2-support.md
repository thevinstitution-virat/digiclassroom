# Phase 2 support: what was prepared (4 Nov 2026, no model calls)

## C1. Teacher pack
- `docs/hw-eval/teacher-pack/teacher-pack.pdf` (A4, 4 pages, English and Hindi side by side; source `teacher-pack.html`). Page 1: what it is, what to do, the three rules. Page 2: the four verdicts with the draft wording in both languages and two examples of each. Page 3: the ten example answers with the marks under each rule. Page 4: an answer sheet with a separate column for each of the two teachers (name, subject, medium, the decision, per-subject rules, the ◆ cases, agreement with the definitions, free-text changes, signatures).
- Devanagari renders (the PDF embeds Nirmala UI; checked on the rendered page). The Hindi of the verdict definitions was written for this pack, not translated by a person, so a Hindi-medium teacher should read it once before it is used (the footer says so).
- The older two-page kit (`partial-credit-decision.md` and `.pdf`) is unchanged and still valid.
- **Person-check sheet for `heldout-1d@v1`** (155 items, 40 of them near misses): `docs/hw-eval/person-check/heldout-1d-v1/person-check-sheet.csv` (to fill in on a computer), `person-check-sheet.pdf` (printable) and `person-check-sheet.html`.

## C2. R_min labelling sheet
- **Where:** `hw-evals/rmin-labelling/` in the worktree, **git-ignored** (it quotes textbook passages): `labelling-sheet.csv` (to fill), `labelling-sheet.pdf` (27 pages, to print), `labelling-sheet.html`, and `key.json` (which questions are on-book; **do not give it to the labeller**). Rebuild: `npm run hw:key:labelsheet -w apps/api -- export --passages <passages.jsonl> --out hw-evals/rmin-labelling`.
- **What it holds:** 60 questions in a seeded random order: 40 exercise questions from the book (3 or 4 per chapter, all 12 chapters) and 20 written for topics that are not in a Science book. For each, three candidate passages A, B, C (best word-overlap score, not the dense retriever, so the labelling does not depend on what it judges). Instructions are at the top; the LABEL column is blank (`A`, `A,C`, `none`, `elsewhere:5`).
- **A difference from the stage 1 design, on purpose:** the design speaks of "60 question → passage pairs". One row per question with three candidates and a label of which of them answer it gives the calibration more information than one pair per row, and it records the chapter when the answer is elsewhere. The import step (`import --sheet filled.csv --key hw-evals/rmin-labelling/key.json --out labels.json`) writes the `--labels` file `scripts/hw-key-calibrate.ts` takes, and tells you which labels disagree with how the question was chosen. Round trip tested on a fake filled copy.
- **Limit to know about:** the design asked for pairs from the Class 9 Social Science book. **That book is no longer in the shared library**; the only book there is NCERT Science, Class IX, English (below), so R_min would be calibrated on English Science only. SST and Hindi need their own labelled pairs once those books are in.
- **Who runs the calibration:** `hw-key-calibrate.ts` needs `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION_NAME`, `TRIO_CONTENT_DATABASE_URL` and a real `OPENAI_API_KEY` (to embed the questions). None of these is in this machine's `.env.local` (the OpenAI key is a placeholder), so the run is on the server or with those values supplied. Production holds `HW_KEY_R_MIN` 0.50, uncalibrated; changing it needs your approval.

## C3. Trio ingest check (read-only: SELECTs only, nothing changed)
The shared library is the `trio` database in the DCP Postgres container (schema `library`; the old `content` schema is empty: 0 items, 0 chunks, 0 ingest runs).

**Books in the shared library: one.**

| Field | Value |
|---|---|
| Book | NCERT **Science, Class IX**, English medium (code `sci9-en`) |
| ISBN | 8174504923 |
| Edition | Reprint 2025-26 |
| Publisher | National Council of Educational Research and Training |
| Status | published 2026-10-26 22:23 UTC |
| Chapters | 12 (Matter in Our Surroundings … Improvement in Food Resources, printed pages 1 to 151) |
| Passages | 987: 664 reference (400 prose, 110 feature boxes, 93 figures, 31 examples, 21 tables, 9 graphs) and 323 practice (320 discussion prompts, 3 activities) |

**There is no Class 9 or 10 Social Science book, no Class 10 book of any subject, and no Hindi-medium book.** The Class 9 SST book (twice) and the Class 11 Geography book that the stage 1 design found on 25 Oct were **wiped deliberately on 26 Oct** (library hub plan, Phase 8): the old Qdrant collection was deleted at 17:05:50 UTC and the `content` tables truncated at about 17:07 UTC. Evidence and the protection gap this exposed (Qdrant has no API key) are in roadmap task 2.1 and decision D12. (Qdrant point counts were not read through its API; the collection list on disk and the request log were used instead.)

**Can the Markdown ingest lane ingest in production now?** Evidence only, no test ingest (a test would write): 22 ingest runs, all on 26 Oct 2026. The 12 `live` runs and 6 `preview` runs of the final pass succeeded (last at 21:58 UTC); 4 earlier `live` runs the same evening failed on a database check (`practice_item_parts_check`) and were followed by successes, so that was fixed. **Nothing has been ingested since 26 Oct**, so the lane is unproven for a new book, for Hindi-medium text, and for today's build. The known issue `docs/known-issues/orphaned-ingest-runs.md` still applies (a process killed mid-ingest leaves the run `running`).

## D and E
- **D (runs that need credit): skipped.** OpenRouter balance is still -$0.045 and `.env.local` has no Gemini key and only a 26-character OpenAI placeholder. Nothing was run; ₹0 spent.
- **E (Phase 3): not started.** It starts from the new `main`, which does not exist until the push in `merge-hw-cost-runbook.md` is done.
