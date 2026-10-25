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

A metric the baseline has and the candidate does not measure is a failure. A run that
stopped at its budget is not a pass.

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
request into `main`. It needs the repository secret `HW_EVAL_ENV` (the env file) and the
variables `HW_EVAL_DATASET`, `HW_EVAL_BASELINE` and `HW_EVAL_BUDGET_INR`.
