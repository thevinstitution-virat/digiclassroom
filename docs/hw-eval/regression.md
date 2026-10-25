# Virat Evaluator: the regression gate

**Rule:** a change to the reader or grader prompts, the models, the reading route
(tiers, escalation thresholds, media resolution, thinking level) or answer-key generation
is merged into `main` only after the regression gate passes on the frozen regression set.

## What it checks

The candidate configuration runs on `regression@vN` (150–300 items across sources, subjects
and languages; changed only by a version bump) in `e2e` mode, and is compared with the
baseline run of the current production configuration on the same version:

| Metric | Fails when |
|---|---|
| QWK, per mark scale | drops by more than 0.02 |
| Normalised MAE | rises by more than 0.05 (MAE + 0.05·M) |
| Reading CER | rises by more than 1 percentage point |
| Injection resistance | is below 100% |

**Noise-aware, paired.** The same configuration run twice does not give identical marks
(default temperature): in the small run, one answer of 25 changed between two runs of the
production settings, which moved the 2-mark QWK from 0.976 to 0.884 and failed a plain
"−0.02" comparison. Both runs mark the same items, so the gate bootstraps the *change* over
those items, pairs kept together. A metric fails only when it is worse by more than the
tolerance **and** the 95% interval of the change lies entirely on the worse side of zero.
Injection resistance stays absolute: one working injection fails the gate.

A metric the baseline has and the candidate does not measure is a failure. A run that
stopped at its budget is not a pass. To judge an existing run again without new calls, pass
`--candidate <runId>`.

## The current sets

| Set | What | Baseline run |
|---|---|---|
| `regression-smoke@v1` | 59 items: the small run's 20 known texts and 39 mutation answers, **synthetic font images**. Catches gross breakage (output format, injection, a broken route); says nothing about real handwriting. | `run_regr_smoke_baseline` (production settings, e2e, 25 Oct 2026), in R2 |
| `regression@v1` | To be frozen in the pilot (pilot-plan.md step 0.5) from real writing: 150–300 items across sources, subjects and languages. Replaces the smoke set as the merge gate. | — |

## Running it

From the repo root (keys, prices and R2 credentials come from `apps/api/.env.local`):

```bash
npm run hw:eval:regression -w apps/api -- --dataset regression@v1 --config ../../docs/hw-eval/configs/candidate.json --baseline <runId> --budget-inr 300
```

The result is in `hw-evals/runs/<run_regr_…>/regression.json`; the exit code is 0 for
pass and 1 for fail.

### Making the baseline

When the production configuration changes (after its own gate passed), run it once and keep
the run as the new baseline:

```bash
npm run hw:eval -w apps/api -- --dataset regression@v1 --config ../../docs/hw-eval/configs/production.json --mode e2e --budget-inr 300 --upload
```

`--upload` stores the run under `hw-assignments/evals/runs/<runId>/` so CI can download it.

## In CI

`.github/workflows/hw-eval-regression.yml` runs the same gate. It calls paid APIs, so it
never starts by itself: run it from the Actions tab, or add the label `run-eval` to a pull
request into `main`. It needs the repository secret `HW_EVAL_ENV` (the env file: OpenRouter key, HW_PRICE_TABLE_JSON, R2 credentials) and the
variables `HW_EVAL_DATASET`, `HW_EVAL_BASELINE` and `HW_EVAL_BUDGET_INR`.

For the smoke set: `HW_EVAL_DATASET=regression-smoke@v1`, `HW_EVAL_BASELINE=run_regr_smoke_baseline`, `HW_EVAL_BUDGET_INR=20` (a smoke run costs about ₹6).
