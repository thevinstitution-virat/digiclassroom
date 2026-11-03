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

## Task 3. Strict profiles under each rule

Both strict profiles were re-run with the four-verdict prompt, 5 runs each. Done: the phase 1b smoke set (`smallrun-b@v1`, 39 items, 195 marked answers per profile; cost ₹8.8 and ₹2.5).
**Not run** (no credit): both profiles on `heldout-1c@v1`, and M0-strict on `heldout-1d@v1`. See the end of this section for M1-strict on `heldout-1d@v1`.
Tables are produced by `npm run hw:eval:rules` from the stored verdicts, so the three rows of a table come from the **same** model outputs.

**Read these with care.** Detection, false credit and exact total are against the by-construction expected marks, which give a wrong-fact variant 0 under every rule. Under `half` or `full`,
a wrong fact the grader calls `right_idea_wrong_detail` is paid, and counts as a miss here. For the "replaced" variants (a number, a name or a whole fact changed) that is not necessarily an
error: it is the rule's price, and what the teachers decide. For **reversed** variants (the variant says the opposite) it is a real leak. The smoke set was also the set the strict design
was shaped on in phase 1c, so its `zero` rows are in-sample.

### Smoke set, M0-strict (195 answers: 70 mark-removing points, 35 paraphrase/spelling answers, 15 injections)

| Rule | Detection | False credit (marks given back / removed) | False deductions, paraphrase and spelling | Injections resisted | Exact total |
|---|---|---|---|---|---|
| zero | 100.0% (70/70) | 0.0 / 70.0 (0.0%) | 0.0% (0/35) | 100.0% (15/15) | 100.0% (195/195) |
| half | 77.1% (54/70) | 8.0 / 70.0 (11.4%) | 0.0% (0/35) | 100.0% (15/15) | 91.8% (179/195) |
| full | 77.1% (54/70) | 16.0 / 70.0 (22.9%) | 0.0% (0/35) | 100.0% (15/15) | 91.8% (179/195) |

### Smoke set, M1-strict

| Rule | Detection | False credit (marks given back / removed) | False deductions, paraphrase and spelling | Injections resisted | Exact total |
|---|---|---|---|---|---|
| zero | 100.0% (70/70) | 0.0 / 70.0 (0.0%) | 0.0% (0/35) | 100.0% (15/15) | 100.0% (195/195) |
| half | 92.9% (65/70) | 2.5 / 70.0 (3.6%) | 0.0% (0/35) | 100.0% (15/15) | 97.4% (190/195) |
| full | 92.9% (65/70) | 5.0 / 70.0 (7.1%) | 0.0% (0/35) | 100.0% (15/15) | 97.4% (190/195) |

Under `zero` both profiles are at least as good as phase 1c's best on this set (plain M0 66/70, M0-single 64/70, M1 47/70); the near-miss agreement column is empty because the smoke set has no near-miss items.

### How often a reversed fact gets `right_idea_wrong_detail` instead of `different_fact`

Judgements on the changed key point of the wrong-fact variants (5 runs x 7 variants = 35 per profile). The 7 are classified with the structural rule in `wrong-fact-classes-1d.json`
(reversed = the variant says the opposite; replaced = a number, name or whole fact changed). **That classification of the smoke items was made after their M0-strict verdicts had been seen**; the one for the 40 variants of heldout-1c/1d was
fixed before any v2 run on them.

| Variants | M0-strict `right_idea_wrong_detail` | M1-strict `right_idea_wrong_detail` |
|---|---|---|
| **Reversed** (door open / plenty of sunlight; watered every morning / more water; the shortage grew / wells dried): 3 variants, 15 judgements | **3 of 15 (20%)**: door open 2, watered every morning 1 | **0 of 15 (0%)** |
| Replaced (oxygen for carbon dioxide; the two dairy variants with several details changed; wheat for rice): 4 variants, 20 judgements | 13 of 20 (65%) | 5 of 20 (25%) |
| All 7 variants, 35 judgements | 16 of 35 (45.7%) | 5 of 35 (14.3%) |

So the leak from reversed facts is **real but small on M0-strict and not seen on M1-strict**, and it is the reason both profiles lose detection under `half` and `full`. Under `half`, the 3 leaked reversed-fact judgements
in M0-strict are 1.5 marks given for answers that say the opposite of the key. A 15-judgement sample from 3 variants cannot rank the two profiles; it does say the leak exists. The held-out sets (40 reversed/replaced variants)
were meant to measure it properly and are **not run** for M0-strict.

## Task 4. Do grouped marks depend on the neighbours?

**Design, fixed before the runs** (`eval/grouping.ts`, `npm run hw:eval:grouping`): every smoke answer is marked in 3 different random groupings (seeds 11, 22, 33), 2 runs per grouping, with the
shuffle held fixed inside a grouping (`--fixed-grouping`; until now each repeat of a run reshuffled, so the 5 runs of phase 1b/1c mixed grouping and noise). For each answer: *within* =
the largest gap between its two runs inside one grouping; *across* = the gap between its highest and lowest grouping mean; it has **moved** when across > within. One-answer-per-call
M1-strict, run the same way, is the noise reference (nothing shares its call, so any move there is run-to-run noise). A grouped profile is recorded as grouping-sensitive when it moves
more answers than the reference **and** a one-sided Fisher exact test gives p <= 0.10 (loose, because n is 39).

| Profile | Runs | Answers moved across groupings | Size | Direction |
|---|---|---|---|---|
| M1-strict (noise reference) | 3 groupings x 2 runs, 234 marks | **0 of 39** | – | – |
| M0-guarded | 3 groupings x 2 runs, 234 marks | **2 of 39 (5.1%)** | 1 answer by 1 mark, 1 by 0.5 | one moved down, one up: a Hindi-English mixed answer that earns 2 of 2 in two groupings got 1 in the third (a false deduction of 1 mark, both runs); the Hindi wheat-for-rice variant (expected 1, a "right idea, wrong detail" case) got 1.5 in one grouping (+0.5) and 1 in the others |
| M0-strict | **not run** (no credit) | – | – | – |

M0-guarded against the reference: 2/39 against 0/39, one-sided Fisher **p = 0.25**: by the rule fixed beforehand, **grouping sensitivity is not shown**. The test has little power: two moved answers
cannot be told from chance, and the reference itself did not move at all (M1-strict gave every answer the same mark in all 6 runs), so the grouped profile is the noisier one in this sample, by two answers.
Both moved answers are Hindi. Recorded in `pilot@v1` as measured and not shown for `M0-guarded`, and as **not run** for `M0-strict`; the second is unknown, not clear.

## What stopped the runs

The OpenRouter account ran out of credit: `GET /api/v1/credits` showed $10.00 bought and $9.85 used (about ₹13 left) when marking calls began to fail with `HTTP 402 … would exceed your available credits given your current in-flight requests`,
and it ended at **-$0.04** after I spent what was left. That is the account's balance, not this task's ₹150 allowance (₹35 of which was spent: ₹2.3 on the near-miss variants, ₹32 on runs). I stopped the two chains I had running in parallel (failed rows cost nothing),
resumed the partly-done runs one request at a time on the credit that remained, and spent the rest on the cheapest arms of Tasks 3 and 4, in this order: the smoke runs of both strict profiles, the M1-strict groupings (the noise reference), M0-guarded's groupings,
and M1-strict on heldout-1d (capped at ₹6, which gave 2 of its 5 runs and part of a third).

**To finish**, top the OpenRouter account up (about $3 covers the ₹84 of runs left and the in-flight headroom OpenRouter holds back), then run `hw-evals/cost1d/chainC.sh`: it resumes every partly-done run and runs the rest, one at a time. Still to run, with the measured price of each:
M0-strict groupings for Task 4 (₹10.5); M1-strict on heldout-1d, runs 3 to 5 (₹5); M0-strict on heldout-1d (₹35); both profiles on heldout-1c (₹26 and ₹8).

## M1-strict on heldout-1d (partial: 2 full runs and part of a third, 405 marked answers, ₹6)

`heldout-1d@v1`: 115 items of heldout-1c plus the 40 near misses. The run hit its ₹6 cap after repeats 0 and 1 (155 answers each) and 95 answers of repeat 2; counts below are of what was marked.

| Rule | Detection (mark-removing variants other than near misses) | False credit | False deductions, paraphrase and spelling | Near miss: the near-missed point has its expected marks | Near miss: total is the expected total | Injections resisted | Exact total |
|---|---|---|---|---|---|---|---|
| zero | 98.1% (154/157) | 3.0 / 161.5 (1.9%) | 0.0% (0/64) | 89.5% (94/105) | 88.6% (93/105) | 100.0% (26/26) | 99.0% (297/300) |
| half | 87.9% (138/157) | 11.0 / 161.5 (6.8%) | 0.0% (0/64) | 77.1% (81/105) | 76.2% (80/105) | 100.0% (26/26) | 93.7% (281/300) |
| full | 87.9% (138/157) | 19.0 / 161.5 (11.8%) | 0.0% (0/64) | 87.6% (92/105) | 87.6% (92/105) | 100.0% (26/26) | 93.7% (281/300) |

- **Under `zero` this is phase 1c's M1-strict result again** with the new prompt: detection 98.1% (phase 1c, v1: 98.7%), false credit 1.9% (1.5%), injections 100%. Under `half` and `full` detection falls to 87.9% because wrong-fact variants whose
  changed point the grader calls `right_idea_wrong_detail` are paid; that is the 16 below.
- **Reversed facts: 0 of 36 judgements** (14 variants, 3 runs of most) were called `right_idea_wrong_detail`; all 36 were `different_fact`. Replaced facts (a number, name or whole fact changed; 26 variants): 16 of 68 (23.5%) were.
  All wrong-fact variants: 16 of 104 (15.4%); 3 judged `absent`.
- **Near misses (105 judgements over 40 variants)**: `right_idea_wrong_detail` 81 (77.1%), `different_fact` 13 (12.4%), `same_fact` 11 (10.5%). By item (most common verdict over its runs): 32 `right_idea_wrong_detail`, 4 `different_fact`, 4 `same_fact`.
  Reading the 8 that did not land: three of the four `same_fact` items (the fourth, "Mehra" → "Kanpur", split 1–1 between two verdicts) are near misses in name only: "home" → "family" is a synonym; "contaminated insects" → "contaminated seeds" changes a word the key point ("the first animal affected: frogs") does not state;
  "not safe to drink" → "…once it had been boiled" adds a clause the key point ("the pond water was muddy") does not contain; the grader is right and the by-construction expected marks are wrong. Three of the four `different_fact` items change the thing the point is about
  ("दलहन" → "तिलहन", "बच्चों की" → "शिक्षकों की", "गोबर की खाद" → "रासायनिक खाद"), which the draft definition does count as a different fact. **So the grader and the generator disagree on about a fifth of the near misses, and in each case I side with the grader, which is the reason the person-check sheet exists.**
  Agreement under `zero` and `full` is therefore not a measure of the grader alone.

## Task 4 and pilot@v1

`pilot@v1` (`lib/hw/eval/profiles.ts`): marking is now **M0-guarded (control), M0-strict, M1-strict**. M1 is dropped from the pilot and keeps its definition; M0-single stays in reserve; E0 stays the escalation control; E1 stays pending the Gemini probe.
The partial-credit rule is not set by the code: `HW_PARTIAL_CREDIT_RULE` stays `zero` until the teachers answer the decision kit. The grouping measurement is recorded in the registry (`grouping`): M0-guarded measured and not shown (2 of 39 against 0 of 39, p = 0.25), M0-strict not run.

## What this says, and what it does not

- **The partial-credit rule can wait for the teachers; the code and the data for it cannot.** With the rule on `zero` the strict profiles behave as in phase 1c. With `half` or `full`, M1-strict leaks no reversed fact (0 of 36 + 0 of 15) and M0-strict leaked 3 of 15 on the smoke set;
  that is the difference that would matter at the pilot, and M0-strict on heldout-1c/1d is the run that would tell if it holds.
- **Near-miss agreement is limited by the near-miss set, not only by the grader.** Roughly a fifth of the generated near misses do not do what they say. Do not report the 77–90% as the grader's accuracy until the sheet has been checked.
- **Not measured:** M0-strict on the held-out sets (1c and 1d); the grouping effect for M0-strict; M1-strict beyond 2.6 runs of 1d; Gemini and OpenAI batch behaviour.
- **Checks run:** the full hw suite (402 passed, 2 skipped: the live OpenRouter test) with the scratch Postgres at migrations 014, 015, 019 and 020; the library suites; `tsc` over every hw script (clean) and the web app (no error in an hw file; the pre-existing errors elsewhere
  are unrelated); `next build` (exit 0). The `trpc/sarvagya-router` suite does not load (`@/auth` is not mapped in its jest configuration); it does not touch this work.

Files: the result tables as JSON and the script that finishes the runs are in `docs/hw-eval/cost1d/` (`rules-smoke.json`, `rules-1d.json`, `grouping.json`, `chainC.sh`); the run folders themselves are in the git-ignored `hw-evals/cost1d/runs/`.
