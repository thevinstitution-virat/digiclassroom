# Handwritten Assignments cost work, phase 1d

Partial credit as a setting, a grouping-effect test, and the person-check and teacher decision kit. Branch `perf/hw-cost`, not pushed.
Everything is off by default; nothing was applied to production; no production setting was touched.

**Status at the time of writing.** Tasks 1, 2, 5 and 6 are done. Task 3 is done on the smoke set only, and Task 4 is partly run: the
OpenRouter account ran out of credit (see "What stopped the runs"). Every number below is a measured one; what was not run is marked
**not run**, and `hw-evals/cost1d/chainC.sh` runs the rest once the account has credit.

## Task 1. A fourth verdict, and partial credit as a setting

- The strict profiles (`M0-strict`, `M1-strict`) now use `grade-strict.v2`: per key point exactly one of `same_fact`, `right_idea_wrong_detail`,
  `different_fact`, `absent`, with the verbatim words. Definitions and two examples of each: `docs/hw-eval/verdicts.md` (a draft for the teachers).
  The smoke sets hold only one clean single-detail case, so the second `right_idea_wrong_detail` example comes from the new near-miss set.
- Code turns verdicts into marks from `HW_PARTIAL_CREDIT_RULE` = `zero` | `half` | `full`, default `zero`, with `HW_PARTIAL_CREDIT_BY_SUBJECT`
  (JSON, e.g. `{"science":"half"}`) as a per-subject override (`grader/partial-credit.ts`). `half` is half the point's marks **rounded down to a half
  mark**, so a 1-mark point earns 0.5 and a 0.5-mark point cannot be halved; that is a consequence of marking in half marks, not a decision about credit.
- **Default-rule test** (`partial-credit.test.ts`): for every combination of the three phase 1c verdicts on three key points, with and without evidence
  (54 cases) the items (verdict, quote, marks, confidence) and the total equal an oracle written from phase 1c's rules; and under `zero` a
  `right_idea_wrong_detail` is marked exactly like a `different_fact`. Unset, the configuration reads `zero`.
- Every verdict is stored with its quote: `fact`, `claimed`, `evidence` on each item of `hw_ai_grade.items` (a jsonb column; **no migration**) and on every
  row of an eval run. `npm run hw:eval:rules` recomputes the marks of any run under each rule with no model call (`eval/partial-credit-report.ts`).
- The prompt change is a new version, not an edit: `grade-strict.v1` is untouched and a profile says which it uses (`strictVersion`).
  **Phase 1c measured `M0-strict` and `M1-strict` with v1; from phase 1d the same ids mean v2.** Their results are not interchangeable (see Task 3).

## Task 2. Partial-credit cases, the person-check sheet and the decision kit

**The set.** `heldout-1d@v1` = every item of `heldout-1c@v1`, unchanged (115), plus **40 near-miss variants** (14 in Hindi), 155 items over the same 20 questions.
A near miss keeps the right idea of one key point and gets exactly one detail wrong. Selection rule, fixed before any marking result of this phase existed:
the first two key points of every question, in key order. Written by `anthropic/claude-haiku-5.5` (Anthropic family; the graders are Gemini and OpenAI,
and `assertNearMissFamilies` refuses a same-family mutator for every marking profile). The answers stay byte-for-byte: the model splits the existing
answer into one segment per key point (code checks the pieces join back to the original), rewrites one segment, and code splices it in
(`eval/near-miss.ts`, `prompts/near-miss.v1.ts`, `npm run hw:eval:nearmiss`). Each item records its expected marks under all three rules
(`referenceMarks.byRule`; the top-level `byPoint`/`total` are the `zero` rule's, so every earlier metric reads the same). Labelled **not person-checked**
(`NOT_PERSON_CHECKED.txt`). A first generation pass made only 26 of 40 (the model sometimes returned every segment instead of the one asked for); I accepted
that return shape when the other segments came back unchanged, deleted that unused first set (nothing had been marked on it), and regenerated: 40 of 40.
Cost ₹2.3 in all, ₹1.2 for the kept set.

**Read the near misses with care.** I read all 40 once. About two thirds are clean ("fifty centimetres" → "twenty centimetres", 2017 → 2019). Some are not what
a teacher would call a right idea with one wrong detail: "small insects" → "small birds" is the answer to the question; "कमीशन" → "किराया" and
"बच्चों की" → "शिक्षकों की" replace the thing the point is about; "so it was not safe to drink" → "…once it had been boiled" changes the claim. Where the changed
word is itself the fact (a year, a name), the draft definition would call it a different fact, which is exactly what the teachers' answer will settle. None was
removed, because choosing the clean ones by hand would be tuning the set.

**Person-check sheet.** `docs/hw-eval/person-check/heldout-1d-v1/`: `person-check-sheet.csv` (UTF-8 with a byte-order mark so Excel shows Devanagari),
`person-check-sheet.html` and `person-check-sheet.pdf` (A4 landscape; Edge's print engine, Devanagari checked on a rendering of the page). One row per item
(155): the question and passage, the key point tested, the variant text, the rule it tests, expected marks under zero/half/full, and blank columns for the
checker (approved/rejected, the marks they would give, a comment). The evaluator's own review tools only sample a draft for a freeze, so this exports
the whole set; the `itemId` column and the approved/rejected verdict are the shape `hw-eval-mutate.ts freeze --reviews` reads.

**Decision kit.** `docs/hw-eval/partial-credit-decision.md` (and `.pdf`, two A4 pages, English and Hindi): ten examples (three from the phase 1b class (b)
items, seven new near misses), each with the student's answer and its marks under zero/half/full (0 / 0.5 / 1 for these 1-mark points), and the one question:
*when an answer has the right idea but exactly one wrong detail, how many of that key point's marks should it get: none, half, or all, and does it differ by subject?*
Three examples (5, 9, 10) are marked ◆: more than one detail is wrong, or the changed word is the answer itself; the draft treats those as a different fact.
The Hindi is mine and should be read by a Hindi-medium teacher before it is relied on.

## Task 5. "Not an instruction" in the marking view

Behind `HW_INSTRUCTION_GUARD_ENABLED` (off by default). A flagged answer in the teacher's marking view now has a **Not an instruction** button beside its flag
(English and Hindi strings). One tap:

- records the dismissal with the ids of the patterns that fired, who tapped and when, in a new table `hw_instruction_flag` (**migration 020**, additive, one
  table, not applied to production; `docs/hw-eval/migration-020-runbook.md`);
- lifts the flag for that text, so the answer can go into "accept all" again (the view shows a small "you said this is not an instruction" note instead);
- changes no mark, and a second tap changes nothing.

For the false-positive rate, each answer the screen flags is also recorded **when it is marked** (the denominator), so the rate per pattern is the SQL query in the
runbook. A dismissal belongs to the exact text it was made on (a hash): an edited transcript is screened afresh. Marking never depends on the record: with the
table missing, marking completes and the flag still shows (tested). Tests (integration, scratch Postgres): the flag is recorded with its patterns; the tap lifts it, records
who, and puts the answer back in bulk accept (1 → 2); a different text is not covered; an unflagged answer cannot be dismissed; with the guard off the button is not available
and nothing is recorded; table missing.

## Task 6. Direct batch round trips: skipped

`GEMINI_API_KEY` is absent from `apps/api/.env.local`, and `OPENAI_API_KEY` is present but is a 26-character placeholder (it does not look like a key). I made no call. Submit-to-complete time,
OpenAI batch acceptance of base64 images, and the batch price actually charged remain **unmeasured**; E1 still waits for them.
