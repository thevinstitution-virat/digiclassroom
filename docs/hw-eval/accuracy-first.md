# Accuracy-first configuration (5 Nov 2026)

Decision by the owner: **accuracy over cost.** This records what that means for each step, on the evidence measured so far
(handwriting-style fonts and generated variants: smoke, not decision grade; the pilot's gates on real writing decide).

## A correction to what I said earlier

I told you luna was weak at marking (detection 67-74% against Flash-Lite's 94%). That was **plain luna with the old grade.v1 prompt**
(M1). With the strict-verdict prompt (grade-strict.v2: per key point a verdict and the verbatim words, code computes the marks,
one answer per call, instruction guard) luna is the most accurate marker measured:

| Marker | Where measured | Detection of wrong / removed points | False credit | Notes |
|---|---|---|---|---|
| M0 (Flash-Lite, grade.v1, ten per call) | smoke, 5 runs | 94.3% (66/70) | 2.9% | phase 1b |
| M1 (luna, grade.v1) | smoke, 5 runs | 67.1% (47/70) | 16.4% | phase 1b; **not recommended** |
| M0-strict (Flash-Lite, strict v2) | smoke | 100% (70/70) | 0% | 3 of 15 reversed facts called "right idea, wrong detail"; **not run on the held-out sets**; grouping not run |
| **M1-strict (luna, strict v2)** | smoke | 100% (70/70) | 0% | no reversed fact leaked (0 of 51); answers never moved between runs (0 of 39) |
| **M1-strict** | held-out (heldout-1d, 2.6 runs) | **98.1% (154/157)** | 1.9% | injections resisted 26/26; the only one measured on held-out data |

Not shown yet: M1-strict on real handwriting, on Hindi-medium work at scale, or the full third run of the held-out set.

## What accuracy-first means, step by step

| Step | Setting | Why |
|---|---|---|
| Reading, tier 1 | **`gpt-6-luna`**, low effort (moved 5 Nov, see [luna-reading.md](luna-reading.md)) | Tested on every parameter and matched Flash-Lite (CER 0 on 20 clean and 40 degraded items, English, Hindi, mixed); one bill. |
| Escalation, tier 2 | **`gpt-6-luna`**, low effort (moved 5 Nov) | CER 0 on 40 degraded items. Same model as tier 1: see the limits in luna-reading.md. |
| Marking | **`gpt-6-luna`, low effort, strict v2, one answer per call, instruction guard** (`HW_STRICT_MARKING_ENABLED=true`) | Best measured detection, fewest false credits, no neighbour effect. It is also cheaper than today's marker: the smoke run cost about ₹0.013 per answer (₹2.5 for 195) against ₹0.049 for M0. |
| Partial credit | `HW_PARTIAL_CREDIT_RULE=zero` | Until the teachers answer the decision kit. |
| Answer keys | writer `gemini-3.6-flash`, verifier `gpt-5.4-mini` (different families) | As set in production already. |

## What was built

- `HW_STRICT_MARKING_ENABLED` (default **off**): the grade job uses grade-strict.v2, one answer per call, and code computes the marks
  (`grader/mark-mode.ts`, used by `jobs/grade-handler.ts` for both the standard and the batch path). Off, every request is the one sent today.
- The eligibility fingerprint includes the mode (only when on, so every fingerprint stored before this is unchanged). Turning strict marking
  on therefore marks every group "configuration changed": **no AI suggestion is made for a group until its evaluation runs under the same
  setting are imported.** An evaluation run of M1-strict stands for the product only if the product runs the same setting (grade-strict.v2, one
  answer per call, same model, effort and guard); a run of any other strict prompt or call size still cannot.
- Tests: `strict-marking-mode.test.ts` (9); the eligibility suite updated; the whole hw suite passes (584, 2 skipped, against a real Postgres).

## What is not done

- Nothing is applied to production and no production setting is changed. Production still has no model, no OpenRouter key and no Gemini or
  OpenAI key set for this feature. Setting up marking needs `OPENAI_API_KEY` (or OpenRouter) in the backend's secrets, which only you can add.
- M1-strict has not been run through the gates for any group, so after the flag is switched on nothing is eligible until that is done.
- The held-out run of M1-strict was cut at 2.6 runs for want of credit; finishing it (about ₹6) would firm up the 98.1%.
