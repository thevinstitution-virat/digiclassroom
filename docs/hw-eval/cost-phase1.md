# Handwritten Assignments cost, phase 1

Branch `perf/hw-cost`. No model change ships here: model changes need the Evaluator's gates on real
handwriting. This phase measures where the money goes, adds savings that cannot change an answer, a
mark or a key (each behind its own flag, off by default), and registers the cheaper configurations as
named eval profiles for the pilot.

Everything below was measured on 3 Nov 2026 through `npm run hw:eval` (plus two small direct probes,
`npm run hw:cost:probe`, which `hw:eval` cannot express) on the existing small-run datasets:
handwriting-style **fonts**, not people's writing. Every result is **smoke, not decision grade**.

## What is in the branch

| Piece | Where |
|---|---|
| Every usage detail kept (cache write, reasoning, image/text tokens); cache writes priced; batch cached reads priced | `lib/hw/cost/pricing.ts`, `openrouter/client.ts`, `gemini/client.ts` |
| Request observer: the first request sent for each step, images replaced by size | `lib/hw/ai/observe.ts`, `hw:eval --log-requests` |
| Per-step cost table, grouped reads, forced escalation, image/text token split | `lib/hw/eval/cost-table.ts`, `live-deps.ts`, `hw:eval --read-group --force-escalation --split-image-tokens` |
| Eval profiles R0 R1 R2 R-luna · E0 E-gemini E-sarvam · M0 M1 M2 · K0 K1, with family-rule checks | `lib/hw/eval/profiles.ts`, `hw:eval --profile` |
| The five flagged savings | below |
| Monthly projection | `npm run hw:cost:project`, `lib/hw/eval/cost-project.ts` |
| Price table with sources | `docs/hw-eval/price-table.json` |

## The flags

All default to off. With every flag off, provider requests are the ones sent today (asserted in
`cost-savings.test.ts` and by the existing suites passing unchanged).

| Flag | What it does | Needs migration 019 |
|---|---|---|
| `HW_HOMEWORK_BATCH_ENABLED` | Homework reading and marking go through the provider's batch API. Each batch carries a ready-by time (`HW_HOMEWORK_BATCH_DEADLINE_HOURS`, default 24) shown on the class overview. Work due within `HW_HOMEWORK_URGENT_HOURS` (default 3) or past due, escalation, and anything the provider cannot batch stay on the standard path. A batch that fails, rejects a request, or is not finished by its ready-by time is re-run on the standard path with the reason recorded and shown. | no |
| `HW_SHARED_KEYS_ENABLED` | A textbook key for a public question (`questionOrigin` `textbook_exercise` or `board_paper`) is built once and served to every tenant. | yes (`hw_shared_key`) |
| `HW_CODE_MARKING_ENABLED` | A one-mark answer equal to an accepted answer after normalising (case, spacing, punctuation, NFC, Devanagari digits) is marked in code; recorded as `code`. | yes (`hw_ai_grade_source`) |
| `HW_DEDUPE_MARKING_ENABLED` | Answers with the same normalised transcript, question and key version are marked once; the link is recorded and the teacher sees "same as N other answers". | yes (`hw_ai_grade_source`) |
| `HW_OPENAI_EXPLICIT_CACHE_ENABLED` | GPT-5.6+ models: `prompt_cache_options.mode = explicit`; a `prompt_cache_breakpoint` only after a static prefix of at least 1,024 tokens. | no |

### Migration 019 (expand step; not applied to production)

`packages/core/src/lib/db/migrations/019_hw_cost_phase1.sql` creates two NEW tables and alters
nothing. Where a suggestion came from is a side table keyed by `hw_ai_grade.id`, not a new column on the
append-only `hw_ai_grade`, so the code does not depend on the migration while the flags are off.
Order: apply 019 → deploy → switch a flag on. Rollback: `019_hw_cost_phase1.down.sql`. Tested forward,
back and forward again on a throwaway Postgres. The next free number on `main` was 019 on 3 Nov; renumber
if another branch has taken it.

### What is not wired yet

- **Nothing in the product calls the key service.** `buildKey` is used by the evals and the library hub
  code only, so the shared library has no product caller until the key service is wired into assignment
  authoring. The flag is tested through `buildKey` with a Postgres-backed store (`keys/shared-pg.ts`)
  ready to pass in as `deps.shared`.
- **"Test or urgent" is inferred from the due date**, not set by the teacher: there is no such field on
  an assignment, and adding one would be a column on a hot table. Marking an assignment as a test needs
  that field in a later migration.

## Results

See [cost-phase1-results.md](cost-phase1-results.md): the per-step cost table, what the code does today, the savings of each flag on the same slice, the smoke table for every profile, and the monthly projection.
