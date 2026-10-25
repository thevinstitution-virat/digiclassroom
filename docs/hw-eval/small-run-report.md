# Virat Evaluator: the small real run (25 October 2026)

**What this is:** the first end-to-end run of the measurement system against the real
providers (OpenRouter), on the production reader and grader settings, within a ₹100 cap.
**What it is not:** a measurement of real handwriting. Nobody has written these items by hand
yet. The images are handwriting-style **fonts** (Ink Free and Segoe Print for English; Windows
has no Devanagari handwriting font, so Hindi is in the printed Nirmala UI). The reading numbers
below show the pipeline works; they say nothing about how well students' writing is read. The
pilot (pilot-plan.md) replaces these images with people's writing.

Generated reports: [known texts, reading](small-run/known-texts-read.md) ·
[mutations, marked on the known text](small-run/mutations-mark.md) ·
[mutations, read then marked](small-run/mutations-e2e.md). Inputs:
[questions](small-run/questions.json), [known texts](small-run/known-texts.json).

## Configuration

| Role | Model (OpenRouter) |
|---|---|
| Reader | `google/gemini-3.5-flash-lite`, escalating to `google/gemini-3.6-flash` (production settings: thinking minimal, media low) |
| Grader | `google/gemini-3.5-flash-lite` |
| Key writer | `google/gemini-3.6-flash` |
| Key verifier | `openai/gpt-5.4-mini` (another family from the writer) |
| Mutation writer | `anthropic/claude-haiku-5.5` (another family from the grader) |

Code at `aa15598` plus the changes committed with this report; prompts `read.v1`, `grade.v1`,
`key-writer.v1`, `key-verifier.v1`, `mutate.v2`.

## Datasets

- **smallrun-a** (source A): 20 known texts written for the run, the way students write them,
  with their slips kept ("26 january", "100 degree celsius"): 8 English, 8 Hindi, 4 mixed,
  Science and Social Science. v1 typed, v2 synthetic images.
- **smallrun-b** (source B): 4 passage-based questions (passages written for the run; Class 9–10
  Science and Social Science, one numerical, one in Hindi). Keys built from the given passage,
  verified by the other model family; 3 of 4 questions grounded; **39 variants** across 12
  rules. v1 typed, v3 synthetic images (v2 was discarded, below).

## Results

| Run | Items | Result | Cost |
|---|---|---|---|
| Keys + variants (two passes, below) | 4 questions → 39 | 3 keys grounded and supported; 1 refused | ₹2.03 |
| Reading, smallrun-a@v2 | 20 | CER 0.09%, WER 0.52%: one error, "×" read as "x"; no invented text, nothing catastrophic | ₹0.85 |
| Marking on the known text, smallrun-b@v1 | 39 | QWK 1.000 (2- and 3-mark), exact 100%; detection 100%, false credit 0%, invariance 100%, injection resisted 100% | ₹1.85 |
| Same, ×5 (repeatability) | 195 | all five runs identical for **94.9%** of answers, ICC 0.994; detection over all runs 92.9%, false credit 3.6% | ₹9.25 |
| Read then mark, smallrun-b@v3 | 39 | WER 0.05%, CER 1.4% (line breaks, below); marking on the AI transcript the same as on the known text within 0.013 MAE | ₹5.84 |
| Discarded run (my rendering bug) | 39 | — | ₹5.02 |
| **Total** | | | **₹24.84** of ₹100 |

All groups in the gate table say **Insufficient data**, as they must: 39 constructed answers
and no teacher baseline cannot support a recommendation. One says **Not yet** (Social Science,
source-based, Hindi): detection 75%, false credit 12.5%, from finding 3.

## What the run found

1. **A numerical key cannot be grounded in a passage that does not state the formula.** The
   verifier rejected the speed question's key because the passage gives distance and times but
   not *speed = distance ÷ time* or the unit. That is the design working (no source, no key),
   and it means numerical case questions need the formula grounded in the textbook (or the
   official scheme), not only in the question's passage. → The key service should combine the
   given passage with textbook retrieval for numericals; until then they are `no_grounding`.
2. **The first mutation pass made unfair "wrong fact" variants** (3 of 5 rejected in review): it
   changed a side detail ("paid every *thirty* days") while the point's main claim stayed
   right, so "expected 0 for this point" was not true. Fixed in `mutate.v2`: the rewrite now sees
   the key point it must break and must make every part of it wrong. The second pass's seven
   wrong-fact variants were all sound. The freeze rule (more than 10% rejected → regenerate)
   caught this as designed.
3. **The grader gives partial credit for a wrong detail inside a right idea.** "Farmers could
   irrigate their *paddy*" (the source says wheat) got 0.5 of 1 in 5 of the 7 times it was
   marked (4 of the 5 repeats and the read-then-mark run; the single marking run gave 0); the
   rule expected 0. A teacher might do the same, so this one needs the blind teacher
   marking (source E) to decide whether the rule or the grader is wrong.
4. **The grader is not perfectly repeatable at default temperature.** One answer ("door
   *open*, so it got plenty of sunlight") got 0.5 instead of 0 in one of five runs, though the
   reason is reversed. Single runs would not show this; the 5-run gate exists for it. 94.9% of
   answers were identical across five runs, against a gate of 90%, on an easy set.
5. **The reader drops line breaks in wrapped paragraphs.** Every character error on the
   paragraph images was a line break read as a space; not one word was misread. CER counts
   that, by the design's normalisation. Either the read prompt needs to insist on line breaks, or
   the CER definition should treat a line break and a space alike; this is a decision to make
   before real data, not after.
6. **My own bug, caught by the numbers:** the first rendering of the mutation answers did not
   wrap long lines, so images were cut off; the reader transcribed exactly what was visible and
   the run showed 90% catastrophic reads. The renderer now wraps, the truth of a rendered version
   is the text as drawn, and that run is excluded above.

## Not done here, and why

- **People's handwriting** (the brief's "written by you or a teammate"): the copy sheets
  (`npm run hw:eval:mutate -- sheets`) and the pad copy tasks (`/evaluate/copy`) are ready;
  someone has to write. That is step 1 of the pilot.
- **The person check of the variants:** done by Claude for this run and recorded as such in the
  review file; a person must re-check before any decision rests on these items.
- **Textbook keys:** `HW_KEY_R_MIN` is not calibrated (scripts/hw-key-calibrate.ts needs access
  to Gyankosh from the server). Only passage-based keys were possible.
