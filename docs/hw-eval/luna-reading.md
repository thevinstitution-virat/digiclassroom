# gpt-6-luna for reading and re-reading (5 Nov 2026)

Question: can `gpt-6-luna` replace `gemini-3.5-flash-lite` (tier-1 read) and `gemini-3.6-flash` (tier-2 re-read), so that reading,
re-reading and marking sit on one bill? The owner prefers accuracy; testing was to stay cheap. Smoke tests, not decision grade.

## What was run (ten answers per call, as production sends a submission; one repeat each)

| Run | Items | Luna result | Control |
|---|---|---|---|
| Tier 1, clean (`smallrun-a@v2`: 8 English, 8 Hindi, 4 mixed fonts) | 20 | CER 0.0000, WER 0, invented 0, catastrophic 0 | Flash-Lite, 5 runs earlier (phase 1b): CER 0.00% en and hi, 0.45% mixed |
| Tier 1, **stress** (`stress-a@v1`: the same 20 images, each blurred, skewed, greyed and grained two ways, moderate and heavy) | 40 | CER 0.0000, WER 0, invented 0, catastrophic 0 | Flash-Lite: CER 0 on the 10 items it completed (the run stopped at its budget cap) |
| Tier 2, **stress**, every answer forced to the re-read | 40 | CER 0.0000, WER 0, invented 0, catastrophic 0 | `gemini-3.6-flash` forced re-read not run (a budget cap stopped it); its clean-set result was CER 0.0021 en, 0.0053 hi (phase 1) |
| Tier 1, Hindi, one answer per call (earlier today) | 40 reads | CER 0.0000 | Flash-Lite CER 0.0053 |

Cost per answer, as charged: luna ₹0.0042 (clean) to ₹0.0046 (stress) per read and ₹0.0031 per re-read, against Flash-Lite ₹0.0253 per read.
Latency: about 16 s for a call of ten (15 s on stress); Flash-Lite's ten took about 6 s. Nothing here is on the teacher's critical path
(reads run as background jobs).

## What this shows, and what it cannot show

- **Accuracy parameters checked:** character and word error, invented text, catastrophic reads, per language (English, Hindi, mixed), clean and
  degraded images, ten per call and one per call, tier 1 and tier 2. Luna had no error on any item.
- **No wrong read happened for either model**, even at heavy degradation, so these tests cannot rank them: they show luna is **not worse on this
  material**, not that it is better. Real handwriting is the test that can.
- **Confidence could not be checked.** Both models reported 0.95 on every read (all 110 of them), and nothing was wrong, so there was nothing for a
  confidence score to flag. The product re-reads an answer when the first read's confidence is below 0.7, so a model that says "high" about a wrong read
  is never re-read; this was the failure seen with `gemini-3.5-flash` on Hindi. Whether luna's confidence is trustworthy on real handwriting is unmeasured.
- **A luna re-read follows a luna read.** The point of tier 2 is a second opinion from a stronger or different model. With luna on both, a misread
  that luna makes once, it may make again. The stress set produced no misreads, so this was not exercised either.

## Decision (owner, 5 Nov): move reading and re-reading to luna

Done in the documented setup (`apps/api/.env.example`): `HW_AI_PROVIDER=openai`, `HW_READ_MODEL=gpt-6-luna`, `HW_ESCALATE_MODEL=gpt-6-luna`,
`HW_THINKING_LEVEL=LOW`, `HW_RUBRIC_MODEL=gpt-6-luna`. **No code change was needed**: luna takes the reasoning effort from `HW_THINKING_LEVEL`.
Nothing is applied to production, which has no AI keys or models set for this feature.

To watch in the pilot, on real handwriting: reading error by language; how often a luna read says below 0.7; the share of wrong reads that said 0.9 or higher;
and whether a luna re-read corrects a luna misread. If luna's confidence proves unreliable, set `HW_ESCALATE_MODEL=gemini-3.6-flash` (one line) to
bring back a different model as the second opinion.

## Single billing: what is and is not covered

Reading, re-reading and marking are all on OpenAI (`OPENAI_API_KEY`). Still on other routes: **answer keys** (writer `gemini-3.6-flash`; verifier
`gpt-5.4-mini`, which must be a different model family from the writer, so a luna writer would need a non-OpenAI verifier) and the **"Draft with AI"
key points**, which I set to luna but did not measure. OpenRouter already puts OpenAI and Google models on one invoice if that is the aim, but it cannot
run image batches. The key-service routing is a separate decision.
