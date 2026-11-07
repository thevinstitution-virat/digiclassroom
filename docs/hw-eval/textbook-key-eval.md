# Marking against answer keys built from the textbook (7 Nov 2026)

Question: practice questions in InkBuddy are marked against an answer key the key service builds from the textbook (`textbook_key` groups). All earlier
marking evidence used hand-written key points or keys built from a given passage. Does strict luna marking hold up when the key comes from the book?
A smoke test, **not decision grade** (see "What this cannot show").

## How it was run

- **The book.** The only textbook text on this machine is Chapter 1 of NCERT Class 9 Science (English), 99 passages, in a local test copy of the library
  database. It has no search index, so `scripts/hw-local-hub.ts` serves the hub's search call over it (OpenAI `text-embedding-3-large` vectors through
  OpenRouter, the same model as the library's index). Everything else is the real code: the key service (writer `google/gemini-3.6-flash`, verifier
  `openai/gpt-5.4-mini`, `HW_KEY_R_MIN=0.50`), the mutation generator and the evaluation runner. The book text is copyrighted and stays under `hw-evals/`
  (git-ignored).
- **Questions.** 16 in-book questions I wrote (5 very short, 6 short, 5 long, all answerable from the chapter) and 2 off-book controls.
- **Dataset.** `textbook-key-a@v1`: for each grounded question a correct answer and variants with known expected marks (wrong fact, removed point, padding,
  reorder, spelling, paraphrase, injection, Hindi and mixed versions), written by `google/gemini-3.6-flash`. 162 items. **Not checked by a person.**
- **Marking.** `M1-strict` (luna, low effort, `grade-strict.v2`, one answer per call) three times over all 162 items.
- **Spend.** ₹12.48 for the keys and variants, ₹6.42 for the marking.

## Answer keys from the textbook

| | Result |
|---|---|
| In-book questions with a fully verified key | **13 of 16** |
| Refused: a point the verifier found unsupported by the passages | 2 (the "experiment that shows particles are small" question and the "pressure and temperature turn a gas into a liquid" question) |
| Refused: a point only partly supported | 1 (the "compare solids, liquids and gases" question) |
| Off-book controls ("Newton's second law", "formula of common salt") | **both refused** as below the threshold: best passage 0.346 and 0.353 against `R_min` 0.50 |
| An in-book question for comparison | best passage 0.706 ("how does evaporation cause cooling") |

The service refuses what it cannot support, which is the intended behaviour: those three questions would show "no mark" to a learner. The gap between
about 0.35 off the book and 0.6 or more on it is some evidence that 0.50 is a sensible threshold, on one chapter. It is not the calibration the roadmap asks for.

## Marking against those keys (M1-strict, 3 runs, 482 of 486 answers marked)

| Measure | Result | Gate |
|---|---|---|
| Detection of wrong or removed points | **97.3%** (wrong fact 98.0%, removed point 96.6%) | at least 95% |
| False credit | **2.9%** | at most 5% |
| Injection resistance (an answer that talks to the marker) | **100%** | 100% |
| Invariance (padding, reorder, spelling, paraphrase must not change the mark) | 99.5% | |
| Same marks in all 3 runs | 98.1% (ICC 0.994) | at least 90% over **5** runs |
| Agreement with the expected marks (QWK) | 1.000 in every mark size | needs a teacher baseline |
| Cost | ₹0.0133 per marked answer | |

For comparison, the hand-written-key held-out set (`heldout-1d@v1`) gave 98.1% detection and 1.9% false credit. **Marking against textbook keys is no worse on
this material.**

Four of the 486 answers failed with `finish_reason length` (the reply was cut off). In the product a failed chunk is queued again, so the answer waits; worth
watching on the long, padded answers.

## What this cannot show

- **No group becomes eligible from this.** The report's gate table reads "Insufficient data" in all nine groups: a gate needs at least 60 answers in the group
  (here 72 short, 44 very short, 34 long, English), at least 30 answers marked blind by two teachers (none exist), and a 5-run repeatability check (3 were run).
- **The answers are not students' writing.** They are variants a model wrote, with expected marks by construction; the keys were checked by a model, not a
  teacher. Real handwriting, real mistakes and real half-right answers are untested.
- **One chapter, one subject, English.** Hindi and mixed items are translations of English answers to an English key; there is no Hindi book.
- The questions were written by me knowing what the chapter says.

## What it changes for the pilot

- The textbook-key route works end to end on real textbook text: build a key, refuse what is unsupported, mark against it with the same accuracy as before.
- To make a `textbook_key` group eligible (roadmap 5.3): run the same evaluation on the real book(s) with at least 60 answers per question type, five runs,
  and the teacher double-marking kit; import with `npm run hw:eval:gates -- import … --scheme-source textbook_key`; a person promotes the group in the control room.
- Until a group is eligible, practice learners get their handwriting read and **no mark**, with the reason shown.

Run folder (git-ignored): `hw-evals/runs/run_20261107_f24722da`; report: `hw-evals/reports/textbook-key-a-v1/`.

## Addendum, 7 Nov: luna as the answer-key writer (the owner chose OpenAI for writer and verifier)

Same 13 grounded questions, keys built again with `openai/gpt-6-luna` as writer (low effort) and `openai/gpt-5.4-mini` as verifier, `HW_KEY_ALLOW_SAME_FAMILY=true`
(run `run_20261107_d1b6a97c`, ₹1.49), against the Gemini writer's keys on the same questions (`run_20261107_20ee531f`, ₹3.76).

| | Gemini writer (tested setup) | luna writer |
|---|---|---|
| Keys fully verified and usable | 13 of 13 | **10 of 13** |
| Partly supported (not usable for AI marks) | 0 | 2 |
| Failed the code checks (`key_invalid`) | 0 | 1 |
| Writer cost per key | ₹0.19 | **₹0.021** (9 times less) |
| Writer plus verifier per key | ₹0.29 | ₹0.115 |

So luna is much cheaper as a key writer, and in this one run about a quarter of the questions did not get a usable key (they would show "no mark"; "write it again" re-queues a key, up to three
builds). Thirteen questions in one run is a small sample, and the verifier is not an independent family here. Reading, re-reading and marking with luna were measured separately and are unaffected.
Found by running it: `buildKey` re-checked the family rule itself, so the setting had to be honoured there too (fixed in c44290d, with tests).
