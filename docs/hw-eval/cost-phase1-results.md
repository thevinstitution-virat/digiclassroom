# Handwritten Assignments cost, phase 1: results (3 Nov 2026)

Read [cost-phase1.md](cost-phase1.md) first for what is in the branch, the flags and migration 019.

Money spent: **about ₹33** of the ₹200 cap (35 eval runs ₹31.52; two direct probes and the first probe runs about ₹1.5).
Prices are `docs/hw-eval/price-table.json` (₹88/$; confirmed on 3 Nov against Google, OpenAI and OpenRouter). A call's ₹ is the
provider's reported charge, except for batch-priced profiles and the "batch" columns, where it is the **measured tokens at
the table's batch rates** (the runner makes standard calls).

Everything here is **smoke: fonts, 39 items, not decision grade.** The datasets are handwriting-style fonts, not people's writing.

## Task 1. Where the money goes

Today's settings = `docs/hw-eval/configs/production.json`: OpenRouter, `gemini-3.5-flash-lite` reads, `gemini-3.6-flash`
escalates, `gemini-3.5-flash-lite` marks ten answers to a call, minimal thinking, low image resolution, standard rates.
Datasets: smallrun-a@v2 (20 known texts), smallrun-b@v1/v3 (39 mutation answers).

| Step | Model | Calls per answer | Image px and KB | Input tokens per call (image / text) | Cached | Cache-write | Output per call | Thinking | ₹ per answer | Share of the month |
|---|---|---|---|---|---|---|---|---|---|---|
| tier-1 read, **one answer per call** (how the eval runs it) | gemini-3.5-flash-lite | 1.00 | 185k px, 29 KB | 961 (259 / 702) | 0 | 0 | 86 | 0 | 0.0442 | – |
| tier-1 read, **ten per call** (a submission, as production sends it) | gemini-3.5-flash-lite | 0.10 | 185k px, 29 KB × 10 | 3,516 (2,571 / 945) | 0 | 0 | 760 | 0 | **0.0260** | 28% |
| escalation read, ten per call (forced on every answer, to price the step) | gemini-3.6-flash | 0.10 | same | 3,516 (2,571 / 945) | 0 | 0 | 638 | 0 | **0.0443** per escalated answer | 8% (at 15–20% escalation) |
| key retrieval / embedding | text-embedding-3-large | 1 per key | – | **not measured**: the OpenAI key in this environment is rejected (HTTP 401) and Qdrant is not reachable | – | – | – | – | – | – |
| key writer | gemini-3.6-flash | 1 per key | – | 997 (n/r) | 0 | 0 | 303 | 0 | **0.1658** per key | 7% (writer + verifier) |
| key verifier | openai/gpt-5.4-mini | 1 per key | – | 557 (n/r) | 0 | 0 | 126 | 19 | **0.0865** per key | |
| grade, ten answers per call | gemini-3.5-flash-lite | 0.15 | – | 1,742 (n/r) | 0 | 0 | 1,234 | 0 | **0.0488** | 57% |

End to end, one answer per call (smallrun-b@v3, 497k px / 143 KB images, 26 answers): read ₹0.0553, grade ₹0.0536.
"n/r": the provider does not report it. The read's image/text split comes from a text-only twin of the same request
(`--split-image-tokens`); OpenRouter does not report image tokens.

**The month** (80 answers per student: 8 assignments × 10 questions; your default assumptions): ₹6.87 per student, of which
marking ₹3.91, reading ₹1.92, escalation ₹0.53, keys ₹0.50.

What the table says that the small run's "₹0.15 per answer" did not:

1. **A one-answer read is 73% fixed prompt** (702 of 961 input tokens are the system prompt and labels; the image is 259).
   Production reads a submission in one call, which is 41% cheaper per answer (₹0.0260 vs ₹0.0442). The small run's figure
   used the eval's one-answer shape.
2. **Marking is the biggest step, and its output dominates**: 1,234 of 2,976 tokens per call, at eight times the input price.
3. **No cache was written by Gemini at all, and none was read by anyone** (cache-write 0 and cached 0 on every step).

### What the code does today (Task 1.3)

| Question | Answer | Where |
|---|---|---|
| Does reading or marking use batch? | **Yes, by default in code.** `HW_BATCH_ENABLED` defaults to **true**. Tier-1 reads go through the batch API, one request per submission; escalation always runs synchronously. Marking batches too: one batch per grade job, one request per chunk. **Only on Gemini direct.** Through OpenRouter reads cannot be batched, and I confirmed why: OpenRouter accepts a batch with an inline image (HTTP 202), then fails it two seconds later ("only public http(s) image URLs are supported in batch"). The eval runner never batches, so every eval cost is standard-rate. | `config.ts:38`; `jobs/read-handler.ts:174`; `jobs/grade-handler.ts:128`; `ai/index.ts:38`; `openrouter/client.ts:19` |
| Answers per call, reading | All ink and photo answers of one submission in one call (about ten). Escalation: the escalated answers of that submission in one call. | `jobs/read-handler.ts:39-44, 120`; `reader/gemini-reader.ts:16` |
| Answers per call, marking | Up to `HW_GRADE_BATCH_SIZE` = **10 different students' answers to one question** in one call. | `config.ts:43`; `jobs/grade-handler.ts:68`; `grader/ai-grader.ts:23-24` |
| Does the grader prompt carry raw textbook passages? | **No.** The question, the model answer and the marking scheme (rubric items: id, marks, kind, description). The key service is not wired into the product, so passages never reach the grader. | `prompts/grade.v1.ts:42-56`; `buildKey` is called only by the evals |
| Are 1-mark answers matched in code, as the Phase 1 spec asked? | **Partly.** Only `type === 'very_short'` questions with accepted answers (by type, **not by marks**). The match folds case, punctuation, spacing, NFC and the nukta, **not Devanagari digits**; the suggestion's model is `exact_match`, not a recorded source. | `grader/exact-match.ts:25`; `text/normalise.ts:15-25` |
| Are identical answers marked once? | **No.** Two identical answers in a chunk are both sent. | `pipeline.ts` `gradeByRules`; `jobs/grade-handler.ts` |
| Is any provider writing cache that is never read? | **Not today:** no GPT-5.6+ model is configured (the key verifier is gpt-5.4-mini, which has no write charge) and Gemini wrote 0. **It starts the moment a GPT-5.6+ model is used.** With `gpt-6-luna` and the default (automatic) caching, every call wrote its prompt to a cache and nothing read it: ~1,000-token marking prompts wrote 265 tokens per call (cached 0 on all 39 calls); a key-sized prompt (3.3k tokens) wrote **3,292 tokens on every call, none read**, at 1.25× the input price (+27% on the call). | table below; run `run_20261102_c49e03b9` |

Cache probe (`npm run hw:cost:probe -- cache`, `gpt-6-luna`, ~3.3k-token key-writer-shaped prompts):

| Mode | Call | Cached | Cache-write | Cost |
|---|---|---|---|---|
| default, three questions over the **same** passages | each | 0 | 3,292 | $0.000448 |
| default, three questions over different passages | each | 0 | 3,289–3,359 | $0.000431–0.000441 |
| explicit, no breakpoint, the same three | each | 0 | **0** | $0.000348–0.000354 (**−21%**) |
| explicit, breakpoint after the shared passages | 1st / 2nd question | 0 / **3,282** | 3,282 / 0 | $0.000427 / **$0.0000576** (−84% against uncached) |

The automatic breakpoint sits at the end of the whole user message, so a different question never matches an earlier prefix:
in default mode the writes are pure cost. A breakpoint pays only where the same prefix is sent again (the same passages for
several questions).

## Task 2. Savings that cannot change an answer, a mark or a key

Commits on `perf/hw-cost`: `2585ebc` (usage, profiles, tools), `c3a3e85` (the five flags and migration 019), and the commit that
adds this report, the projection and E1. Nothing is pushed; nothing is merged; nothing is applied to production.

Tests: the new files are `cost-instrumentation` (26), `cost-savings` (31), `cost-savings-integration` (13, against a real
Postgres with 014, 015 and 019), `cost-project` (13). All hw suites pass, `tsc` is clean for every hw file, `next build` passes.
With every flag off the request is the one sent today (asserted for the read, grade and chat bodies; the existing integration
suite passes unchanged).

| Flag | Tests | Measured saving on the same slice | Projected (default assumptions) |
|---|---|---|---|
| `HW_HOMEWORK_BATCH_ENABLED` | 4 unit rules; 6 database flows: homework batched with a visible ready-by; due-soon stays standard with a reason; a failed batch, an overdue batch, a rejected request and a failed marking batch each re-run on the standard path, visibly, with no failed job | Reads −50% (₹0.0260 → 0.0130) and marking −50% (₹0.0488 → 0.0244), from the same tokens at batch rates. **Most of this already exists** (`HW_BATCH_ENABLED=true`); the flag adds routing, the visible status and the visible fallback | batch alone ₹6.87 → **₹3.95** (−42%) |
| `HW_SHARED_KEYS_ENABLED` | 11 unit tests: a custom question is never read or written, for any tenant; passage and partly supported keys are never shared; a new edition, ISBN, passage text, model, threshold, question or mark value is a different key | **0 on the slice**: its keys come from the question's own passage, which is never shared, and textbook keys need Qdrant, which is unreachable here. A K0 key costs ₹0.2523, a K1 key ₹0.1013 | keys ₹0.50 → **₹0.15** |
| `HW_CODE_MARKING_ENABLED` | 9 unit tests + 1 database flow: only exact matches skip the AI; a non-match still goes to the AI; source recorded as `code` | **0 on the slice** (no accepted-answer one-mark questions in the datasets); the flow shows the AI call skipped | marking −15%, ₹0.59 (assumes half of one-mark answers match exactly: **my assumption**) |
| `HW_DEDUPE_MARKING_ENABLED` | 4 unit tests + 3 database flows: reused only for the same question, key version and normalised transcript; case or punctuation differences are marked separately; the teacher sees "same as 1 other" | **0 on the slice** (no duplicates in any dataset); the flow shows two identical answers become one AI answer | marking −10%, ₹0.39 |
| `HW_OPENAI_EXPLICIT_CACHE_ENABLED` | 6 unit tests: GPT-5.6+ only; explicit mode and no breakpoint under 1,024 tokens; one breakpoint after a long enough static prefix | marking: **−3.2%** (₹0.0156 → 0.0151; about 10,300 tokens written, none read, over 39 calls); key-shaped prompt: **−21%**, and −84% on repeated passages with the breakpoint | ≈0 on today's models (none is GPT-5.6+) |

Real batch round trip (`npm run hw:cost:probe -- batch`): an OpenRouter text batch of two requests finished in **5 min 28 s**
with usage fields (including `reasoning_tokens` and `cache_write_tokens`) but **no `cost` field**, so batch calls are priced
from the table, as the code already does. Images cannot be batched there.

**All five flags together on today's models: ₹6.87 → ₹3.14 per student per month (−54%).**

## Task 3. Profiles (smoke: fonts, 39 items, not decision grade)

₹ per answer (key: per key), on the measured tokens. English and Hindi are from separate 8-item runs.

| Profile | What it is | ₹ at standard rates | ₹ at batch rates | Smoke quality, not decision grade |
|---|---|---|---|---|
| **R0** | flash-lite, ten per call, low resolution | 0.0260 (en 0.0268, hi 0.0265) | 0.0130 | CER 0.0019, WER 0.010 (20 items) |
| **R1** | the R0 request, priced as batch | 0.0268 / 0.0265 | **0.0134 / 0.0132** | CER 0 on 8 en + 8 hi (the 20-item run failed on a provider 429 and was replaced by the two) |
| **R2** | R1 at MEDIUM (sent as OpenRouter detail `high`) | 0.0484 / 0.0482 | **0.0242 / 0.0241** | image ~259 → ~1,300 tokens; no gain visible (CER en 0, hi 0.0027) |
| **R-luna** | gpt-6-luna, low effort, English only | **0.0035** | 0.0017 | CER 0, WER 0 on 8 English items |
| **E0** (added: today's escalation) | gemini-3.6-flash, standard | en 0.0422, hi 0.0491 | 0.0211 / 0.0245 | CER en 0.0021, hi 0.0053 |
| **E1** (added) | the E0 request, priced as batch | 0.0422 / 0.0491 | **0.0211 / 0.0245** | same as E0 |
| **E-gemini** | gemini-3.5-flash, batch | 0.1105 / 0.2552 | **0.0553 / 0.1276** | en CER 0; **Hindi CER 0.379, WER 0.71, 12.5% catastrophic, reader confidence 0.95** |
| **E-sarvam** | Sarvam Vision | **not runnable**: no key, reader not implemented | ₹0.50 per page (published) | – |
| **M0** | flash-lite, ten per call | 0.0488 | 0.0244 | QWK 1.00/1.00; mutation detection 93–100% over two runs; false credit 0–3.6% |
| **M1** | luna, low effort, one per call, value points only | **0.0151** | 0.0076 | QWK 0.95/0.96; exact 92%; large errors 5.1%; detection **79–86%** over two runs; false credit 7–11% |
| **M2** | M1 with effort none | 0.0147 | 0.0074 | QWK 0.95/0.92; detection **71%**; false credit 14% |
| **K0** | flash writes, gpt-5.4-mini verifies | 0.2523 (writer 0.1658 + verifier 0.0865) | 0.1262 | 3 of 3 keys grounded |
| **K1** | luna writes, gemini-3.6-flash verifies | 0.1013 (writer 0.0164 + verifier 0.0850) | **0.0507** | 3 of 3 keys grounded |
| R1 + E-gemini + M1, end to end | | read 0.0267 (batch) + grade 0.0151 | | CER 0.013 (line breaks); QWK 0.92/0.92; detection 64%; false credit 18% |

Family rules are checked when a profile set loads and a violation is refused: a key verifier from the writer's family, or a
grader from the mutation generator's family (`anthropic/claude-haiku-5.5`). K1 is an openai writer with a google verifier.
Every marking profile marks one answer per call except M0, which is today's ten.

Parameters actually sent (from `--log-requests`): every call is `POST /chat/completions` on the standard path; image `detail`
`low` for R0, R1, R-luna and E, `high` for R2; `reasoning.effort` `minimal` (Gemini), `low` (luna in M1, K1, R-luna), `none` (M2);
`prompt_cache_options: explicit` on luna calls when the flag is on; no breakpoint on any marking or reading call (their static
prefix is under 1,024 tokens). The K1 run was priced at standard rates (a harness bug, fixed in the report commit); its
batch rate is above.

## Projected monthly cost (₹, default assumptions)

`npm run hw:cost:project -- project --combos headline` (also `--combos all`, `--flags none`, and every assumption as a flag).
Unit costs: `docs/hw-eval/cost1/unit-costs.json` (measured), `unit-costs-2027-01-01.json` (the same tokens at the 2027 prices).

| Configuration | Per student | Per teacher (120 students) | Per guardian (1 child) |
|---|---|---|---|
| **today's settings** (R0 E0 M0 K0), standard rates | **₹6.87** | ₹824 | ₹6.87 |
| + the batch that `HW_BATCH_ENABLED=true` already gives on Gemini direct | ₹3.95 | ₹474 | ₹3.95 |
| **the five Task 2 flags alone**, today's models | **₹3.14** (−54%) | ₹377 | ₹3.14 |
| R1 + E-gemini + M1 + K1 + flags | ₹2.42 | ₹291 | ₹2.42 |
| R2 + E-gemini + M1 + K1 + flags | ₹3.20 | ₹384 | ₹3.20 |
| R-luna + E-gemini + M1 + K1 + flags | ₹1.92 | ₹231 | ₹1.92 |
| **R-luna + E1 + M1 + K1 + flags** (cheapest) | **₹1.22** (−82%) | ₹146 | ₹1.22 |
| the same after the 1 Jan 2027 price rise of gemini-3.6-flash | ₹1.51 | ₹181 | ₹1.51 |
| R-luna + E-sarvam + M1 + K1 + flags | ₹6.89 | ₹827 | ₹6.89 |

All 96 combinations: `projection-all.csv` (flags on), `projection-all-noflags.csv`, `projection-all-2027-01-01.csv` in
`docs/hw-eval/cost1/`. A per-teacher figure is the whole class's AI cost; a per-guardian figure is the child's cost times
`--children`.

**Assumptions that were not in your table and are mine** (all parameters): 50% of one-mark answers equal an accepted answer
(`--exact-match`); 40 students share one key (`--class-size`); every question needs a key (`--keyed`); 120 students per
teacher; one child per guardian; one Sarvam page per answer; R-luna reads Hindi with R1 because it was run on English only.
Shadow mode is off and is not modelled.

## What the pilot should carry into steps 1–3

- **Reading:** R0 (control) and R-luna (English); R2 only if R0's CER on real handwriting is poor. R1 is the R0 request, so it
  tests batch latency, not accuracy, and needs Gemini direct for images.
- **Escalation:** E0 and E1. **Do not carry E-gemini**: gemini-3.5-flash costs twice as much per token as 3.6-flash, wrote more
  output, and on printed Devanagari produced garbled text with confidence 0.95, which the confidence-based escalation cannot
  catch. E-sarvam only as a measured Hindi comparator: ₹0.50 per page is about ten times E0.
- **Marking:** M0 (control) and M1. **Drop M2**: no cheaper than M1 and weaker on the smoke. M1 is 69% cheaper but its
  mutation detection was 71–86% on the smoke against M0's 93–100%; the pilot's gates (≥ 95% detection, ≤ 5% false credit)
  decide, not this table.
- **Keys:** K0 and K1.

## Surprising, and not measured

Surprising:

1. The code already batches by default, so ₹2.92 of the ₹3.73 the five flags save is saving the product would get anyway
   on Gemini direct. The eval, and any OpenRouter deployment, pay standard rates.
2. OpenRouter cannot batch images (it accepts, then fails the batch in two seconds). Reading in batch needs `GEMINI_API_KEY`
   with `HW_AI_PROVIDER=gemini`, or public image URLs, which we will not publish.
3. gemini-3.5-flash is dearer than the newer 3.6-flash and unusable for Hindi here. **3.6-flash doubles on 1 Jan 2027**
   (input $0.75 → $1.50, output $3.75 → $7.50), which moves escalation and key cost by about 2×.
4. Sarvam at ₹0.50 per page is about twelve times the Gemini escalation read.
5. The system prompt is most of a one-answer read, so the eval's per-answer read cost overstates production by about 70%.
6. `gpt-6-luna` at "low" and "none" reasoned for about 11 and 0 tokens: the effort setting barely changes its cost.
7. `gemini-3.5-flash` is not on Google's pricing page (only on OpenRouter, $1.50 / $9.00, matching your table).
8. Migration numbers 016–018 are taken on `main`; mine is 019.

Not measured:

- **Key retrieval/embedding**, and **textbook keys** at their real ~5k-token size (only ~1k-token passage keys were run).
- **Real handwriting** (all fonts), natural escalation rates (zero on fonts; 15%/20% are assumed), Gemini-direct batch latency
  and its 24-hour tail, **Sarvam**, and shadow-mode cost.
- **Code marking, identical answers and shared keys on real work.** The slice has no accepted-answer one-mark items, no
  duplicates and no textbook keys, so these are shown by tests and projected from assumptions only.

Deviations from the brief: two small direct probes (`hw:cost:probe`, under ₹1.5) are outside `hw:eval`, which cannot express a
cache or a batch round trip; `apps/api/.env.local` (untracked) now has the new price table and ₹88/$ instead of ₹84; a
throwaway Postgres container (`dcp-hwcost-pg`, port 5461) was used for the database tests.
