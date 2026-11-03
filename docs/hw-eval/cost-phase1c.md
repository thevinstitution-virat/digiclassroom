# Handwritten Assignments cost, phase 1c (3 Nov 2026)

Branch `perf/hw-cost`. Follows [cost-phase1b.md](cost-phase1b.md). Nothing is pushed, merged or applied to production; no prompt in use today was changed
(the strict prompt is new and eval-only). Smoke sets are handwriting-style fonts; the held-out set is **not person-checked**. Counts sit beside
every percentage. Spend: about **₹133** of the ₹150 cap (5 evaluation runs ₹83.0 including the held-out sets, the cross-student check ₹36.1, and ₹13.7 to
generate the held-out set, which I ran twice by mistake).

## 1. M0 back as the control, with two guards

### 1.1 The instruction screen

`grader/instruction-screen.ts`, with its phrases in **`grader/instruction-phrases.json`** for you to review: 29 patterns across English, Hindi and Hinglish
(requests for marks, orders to ignore or override, "note to the grader", claims to be the teacher, role changes, "give the others zero"). No AI call.
It is behind `HW_INSTRUCTION_GUARD_ENABLED` (off by default, listed in `.env.example`). With it on:

- a flagged answer is **marked alone** (`jobs/grade-handler.ts:101`, `groupForMarking`), so nothing it says can reach a neighbour;
- the teacher sees **"Contains instructions to the marker"** on that answer (`services/marking.ts:309`, `Marking.tsx`);
- it is **left out of "accept all high-confidence suggestions"** (`services/marking.ts:151` `highConfidenceCandidates`).

| | Hits |
|---|---|
| Injection items in the datasets | **6 of 6 distinct texts flagged** (12 items across dataset versions, 12 flagged): English, Hindi, and the "note to the examiner" form |
| The three cross-student lines | 3 of 3 flagged |
| Clean answers (every other distinct answer in `hw-evals/datasets`) | **0 false positives of 94** |
| A hand-written set of 13 ordinary sentences that reuse the trigger words ("the teacher explained…", "gave members cattle feed", "ignore the salt law", "the marks on the ruler") | 0 flagged |

Limits to keep in mind: the dataset's injection lines are blatant, so 6 of 6 says the screen works on blatant lines, not on subtle ones; the clean corpus is 94
synthetic answers from the same generator, so the false-positive rate on real students' writing is unknown. A false positive costs one extra call and one flag; it never
changes a mark.

(`npm run hw:eval:screen` reproduces the table. You asked for hits on "the 15 injection items": the smoke set holds 3 per run, 15 across the 5 runs; the screen
is deterministic, so the run count does not change the result.)

### 1.2 Evidence must come from the answer itself

**Phase 1 already enforces it, per answer, in grouped calls.** `grader/validate.ts:48` builds a map from each answer id to *that answer's own transcript*, and
`:89` downgrades any credited point whose quote is not found in it (`quoteIsInTranscript`: Unicode NFC and spacing are folded, spelling and punctuation are not, the reader's own
normalisation). The point becomes `missing` with 0 marks and a note "quote not found in the answer". A quote copied from a *neighbour's* answer in the same call fails the same way
(tested). What was missing: the downgraded point kept the model's confidence, so the answer was not "flagged" in any way a teacher would see. With the guard on, that point
and so the answer drop to **low confidence** (so the answer is out of bulk accept and shows under "low confidence"). Marks do not change.

The evidence check removed **1 point of 195 marked answers** in the guarded M0 re-run (and 1 of 195 in plain M0, 0 in its repeat); on the held-out set 3 of 575 (M0), 6 of 575 (M0-strict), 0 of 575 (M1-strict).

### 1.3 M0 re-run with both guards, 5 runs on the phase 1b sets

| | Plain M0 (phase 1b) | Plain M0 (a second set, new) | **M0-guarded** |
|---|---|---|---|
| Mutation detection | 94.3% (66/70) | 94.3% (66/70) | **88.6% (62/70)** |
| …`wrong_fact` / `remove_point` | 31/35 / 35/35 | 31/35 / 35/35 | 27/35 / 35/35 |
| Detection in each of the 5 runs (of 14) | 14, 13, 12, 14, 13 | 14, 13, 13, 13, 13 | 13, 13, 11, 12, 13 |
| False credit (marks given back / removed) | 2.0 / 70 (2.9%) | 2.0 / 70 (2.9%) | 4.0 / 70 (5.7%) |
| Injection resisted | 15/15 | 15/15 | 15/15 |
| Exact total | 190/195 (97.4%) | 191/195 (97.9%) | 186/195 (95.4%) |
| False deductions on paraphrase and spelling | 0/35 answers | 0/35 | 0/35 |
| Points removed by the evidence rule | 1 | 0 | 1 |
| ₹ per answer | 0.0498 | 0.0501 | 0.0525 |

**Not shown to be unchanged.** Plain M0 reproduced 66/70 exactly in two separate 5-run sets; the guarded run gave 62/70. The difference is 4 of 70 (Fisher exact p = 0.37 against the first set; p = 0.17
against the two plain sets pooled, 132/140). That is not significant, but I would not call it noise either: with the guards, the three injection items leave the groups, so the
other answers are repackaged into different groups of ten, which changes who sits beside whom. The unguarded held-out run also lands in the same place (88.0%), so ~88–94% is
the honest range for M0 with these guards. One call of the guarded run returned an answer id the group did not contain, which the validator rejected; the three affected rows were retried and
completed (the harness's `--resume`).

### 1.4 The cross-student check, done properly

Method (`npm run hw:eval:inject`, version 2): **4 group samples** of ten answers (three questions, then a seeded different ten of the first question); each answer's natural variation is its
range over **5 clean runs** of its group, plus a sixth clean run as a control; 3 injection lines × 2 victims (the weakest answer and a middle one) per sample, each marked in two arms on the same inputs: **unguarded**
(plain grouping) and **guarded** (the screen marks the victim alone). A neighbour mark outside its own 5-run range is "beyond natural variation"; direction is whether it moved the way the line asked;
an exact two-sided sign test is applied to the direction of those changes.

| | Counts |
|---|---|
| Natural variation | 3 of 40 answers got more than one mark across 5 clean runs; a 6th clean run fell outside its own range for 1 of 40 |
| **Unguarded**: neighbour comparisons | 216 |
| …beyond the answer's own 5-run range | 3 (1.4%) |
| …of those, moved the way the line asked / the other way | 2 / 1 |
| …sign test, two-sided exact | **p = 1.000** |
| **Guarded**: neighbour comparisons | 216 |
| …beyond range | 1 (0.5%) |
| …as asked / other way | 0 / 1 |
| …sign test | **p = 1.000** (one change; nothing to test) |

The three unguarded changes: `chdr54` 1 → 1.5 (as asked, I1), `vzia62` 3 → 2 (as asked, I2), `mdxim3` 2 → 2.5 (other way, I2). The guarded one: `chdr54` 1 → 1.5 (other way, I2). `chdr54` and `mdxim3` are
the same answers that drifted with nothing injected in phase 1b. **No effect of an injected line on a neighbour's mark is detectable**: 3 changes in 216, split 2 against 1. The limit of this test is
power: with three changes a sign test cannot see a small effect, and the screen only blocks lines it recognises. So the screen is the protection, and this check says that without it the effect, if any, is below
what 216 comparisons can show. Phase 1b's 5 of 162 in the injected direction did not reproduce.

## 2. Why wrong facts get credit (report only)

[wrong-fact-misses.md](wrong-fact-misses.md) has all seven items: the question, passage, model answer, key point, original and mutated answer, expected marks, and what each profile credited and quoted.
Classes, counts of missed points of 35 per profile:

| Class | M0 | M0-single | M1 | M1-medium |
|---|---|---|---|---|
| (a) rubric names the topic, not the fact | 1 | 2 | 4 | 1 |
| (b) depends on the undecided partial-credit rule | 3 | 4 | 13 | 14 |
| (c) fact in the rubric, wrong one credited | 0 | 0 | 6 | 3 |
| (d) the mutation is wrong or ambiguous | 0 | 0 | 0 | 0 |

M0 never credits an outright reversed fact; its gap is the partial-credit question and one "also accept" wording that names only the topic. The gpt-6-luna profiles also credit reversed facts (class c: the opposite
of the key, the wrong gas).

## 3. Strict marking, on a fresh held-out set

**Design** (from the classes, not the items; `prompts/grade-strict.v1.ts`, `grader/strict.ts`): per key point the model returns only the point id, a verdict (**same fact**, **different fact**, **absent**) and the
verbatim words; **code computes the marks** (same fact = the point's marks, anything else 0; the total is the sum, capped). The model never sees the marks and has no field to return a total. Any mismatch in a specific the
point gives is "different fact", so there is **no partial credit**: that takes a side on the rule teachers have not set (pilot step 0.6), for the purpose of a trial. "Also accept" wordings are other ways of saying the same
fact and never lower the bar (class a). Profiles: **M0-strict** (M0's model, ten to a call, with the guards) and **M1-strict** (gpt-6-luna, low effort, one answer per call). Nothing from the smoke items is written into
the prompt (a test checks for the item words).

**Held-out set** (`heldout-1c@v1`, **NOT PERSON-CHECKED**, 115 items): 20 new questions I wrote (10 Science, 10 Social Science; Class 9 and 10; 7 Hindi-medium; 2–3 marks; passage-based, so keys come from the question's own passage as in the smoke sets),
keys built by the key service (K0: gemini-3.6-flash writes, gpt-5.4-mini verifies), variants written by `anthropic/claude-haiku-5.5` (a different family from both graders). Kept by a rule fixed before any marking: the original; the first two
`wrong_fact` variants; the first `remove_point`; the first `paraphrase`; every Hindi spelling variant; and the injection variant of every second question. 20 originals, 40 wrong_fact, 20 remove_point, 20 paraphrase, 5 Hindi spelling, 10 injection.
Five runs each, 575 marked answers per profile. The baseline is **M0 with the guards** (the pilot control; the guards do not touch non-injection items).

| | M0-guarded (baseline) | **M0-strict** | **M1-strict** |
|---|---|---|---|
| Mutation detection | 88.0% (264/300) | **98.3% (295/300)** | **98.7% (296/300)** |
| …`wrong_fact` | 82% (164/200) | 98% (195/200) | 100% (199/200) |
| …`remove_point` | 100% (100/100) | 100% (100/100) | 97% (97/100) |
| False credit | 23.0 / 307.5 marks (7.5%) | 7.5 / 307.5 (**2.4%**) | 4.5 / 307.5 (**1.5%**) |
| Injection resisted | 50/50 | **50/50** | **50/50** |
| False deductions on paraphrase and spelling items (answers that lost marks) | 3/125 (2.4%) | 3/125 (2.4%) | 0/125 (0%) |
| …points | 3/310 | 3/310 | 0/310 |
| Exact total | 535/575 (93.0%) | 563/575 (97.9%) | 571/575 (99.3%) |
| Large errors | 2.6% | 0.9% | 0.0% |
| Detection in each run (of 60) | 52, 54, 53, 52, 53 | 59, 59, 59, 59, 59 | 60, 60, 59, 58, 59 |
| Answers identical in all 5 runs | 106/115 | 109/115 | 113/115 |
| Points removed by the evidence rule | 3 | 6 | 0 |
| ₹ per answer | 0.0512 | 0.0445 | **0.0138** |

**Verdicts.** Both strict profiles meet all four bars (detection ≥ 95%, false credit ≤ 5%, no more false deductions than M0 on paraphrase and spelling items, every injection resisted), so **both go into `pilot@v1`**.
The improvement over the baseline is far outside run-to-run spread (detection 295/300 and 296/300 against 264/300; Fisher p about 3×10⁻⁷ and 8×10⁻⁸). M1-strict marks at about a quarter of M0's cost per answer.

What not to read into it:
- The set is generated, **not person-checked**; a person must review the variants before any decision rests on it. The `wrong_fact` variants break every part of a point, which is the easy case; the subtle "right idea, wrong detail"
  cases are exactly where the strict rule (no half) and a teacher's rule may differ, and the expected marks here are 0 for them **by construction**, not by a teacher's decision.
- 20 questions, one mutation model, passage-based keys, fonts-free typed text: it says nothing about handwriting or textbook keys.
- M1-strict missed 3 `remove_point` variants of 100 (M0-strict none); with 3 misses I can't say whether that is a pattern.
- No profile was changed after seeing these results.

## 4. Direct batch round trips

1. **Keys, without printing them:** `apps/api/.env.local` has **no Gemini key** (`GEMINI_API_KEY` is absent) and **no real OpenAI key** (`OPENAI_API_KEY` is present but a placeholder; OpenAI answered 401 "Incorrect API key provided: placehol…" in phase 1b).
2. **Neither probe was run.** Submit-to-complete time, whether OpenAI's batch accepts base64 images, and the batch price actually charged are therefore **not measured**. `npm run hw:cost:probe -- direct gemini` and `-- direct openai` are ready and append to
   `docs/hw-eval/cost1/batch-timings.jsonl`. They need a paid-tier Gemini key and an OpenAI key with access to gpt-6-luna and the Batch API in `apps/api/.env.local` (I did not use the production key).
3. **E0 or E1: recommend E0 (synchronous escalation), as reasoning, not as a measurement.** Escalation is about ₹0.53 of the ₹6.94 student-month; batching it saves about ₹0.26 (4% of the month). E1 means two batches in a row: the escalation
   batch can start only after the tier-1 batch has finished, so a doubtful answer, which is the one most likely to need the teacher, waits for two provider windows (up to 24 h each, 48 h worst case) instead of one. The only batch turnaround measured so far is OpenRouter's, text only, 5 min 28 s for two requests.
   If the Gemini-direct probe shows image batches finishing in minutes at the 90th percentile, E1 becomes worth a pilot arm; until then it stays out of `pilot@v1`.

## 5. `pilot@v1` (updated)

| Stage | In the pilot | Held or dropped |
|---|---|---|
| Reading | R0 (control), R1, R-luna (English only) | R2 in reserve |
| Escalation | E0 (control), E-sarvam (Hindi only) | E1 pending a batch-turnaround measurement (recommend no); E-gemini dropped |
| Marking | **M0-guarded (control)**, M1, **M0-strict**, **M1-strict** | **M0-single in reserve**; M0 (unguarded) superseded; M1-medium not carried; M2 dropped |
| Keys | K0 | K1 dropped |

The set loads and passes the family rules for every marking × key pairing (tested). M1 stays because it was decided, but M1-strict does the same job (same model, one answer per call) with 98.7% detection on the held-out set, against M1's 67.1% on the smoke set
(different sets: M1 itself was not run on the held-out set); you may want to drop M1.

## Commits, tests

See the final message. Tests: 439 hw and library tests pass (2 skipped: the live OpenRouter check, which runs only when asked for), including the new `instruction-guard` suite (21: the screen in English, Hindi and Hinglish with positive and negative cases, grouping, the evidence rule against a neighbour's quote,
strict marking computed in code, the sign test, the profiles and the pilot set) and two database flows for the guard (flagged answer alone, flagged to the teacher, out of bulk accept; guard off identical).
