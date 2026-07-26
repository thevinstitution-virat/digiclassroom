# RAG Regression Eval Suite

Ported from the DCP-BAMS fork (the one piece it did better) into the canonical
trio member. Lets you detect quality drift in the AI-tutor RAG pipeline before it
ships, instead of finding out from students.

## Pieces

| File | Purpose |
|---|---|
| `golden-queries.json` | 50 curated queries across buckets (factual / conceptual / procedural / grade_boundary / board_specific) with expected grade/subject/board/chapter + concept keywords + min retrieval count. |
| `run-baseline.ts` | Runs every golden query against the live `/api/ai/chat` SSE endpoint, records latency / chunks retrieved / citation count / keyword-hit-rate / grade-leak, writes `results/baseline-<date>.json`. |
| `compare-results.ts` | Diffs two result files, prints a markdown table, and **exits 1 if any metric regresses** past threshold (latency +20%, tokens +15%, keyword-hit -5pp, any new grade leak). This is the CI gate. |
| `../canary/baseline-snapshot.ts` | Reads `chat_messages_history` and summarizes live RAGAS / latency / cost (p50/p95) over the last N days → `docs/canary/baseline-<date>.json`. Use before/after a model or routing change. |

## Workflow

1. **Start the app** (deps + app): `start-dev.bat` → http://localhost:3000
2. **Capture a frozen baseline** (commit this file):
   ```
   EVAL_EMAIL="you@test.com" EVAL_PASSWORD="…" npm run eval:baseline
   # or: EVAL_SESSION_COOKIE="better-auth.session_token=…" npm run eval:baseline
   ```
   → `results/baseline-<date>.json`
3. **After a change**, run it again to produce a new `results/baseline-<date>.json`.
4. **Gate the change**:
   ```
   npm run eval:compare -- --base results/baseline-<frozen>.json --pr results/baseline-<new>.json
   ```
   Non-zero exit = regression → don't merge.
5. **Live quality snapshot** (RAGAS/latency/cost from real traffic):
   ```
   npm run canary:baseline           # last 14 days
   npm run canary:baseline -- --days 30
   ```

## Notes
- `EVAL_BASE_URL` overrides the target (defaults to the canonical dev port `:3000`).
- Auth: the runner auto-logs-in with `EVAL_EMAIL`/`EVAL_PASSWORD`, or accepts a
  pre-made `EVAL_SESSION_COOKIE`. Use a seeded test account, not a real student.
- `run-baseline.ts` records `promptTokens/completionTokens` as 0 until the
  `/api/ai/chat` SSE stream is instrumented to emit token usage (carried over from
  upstream — wire it in when token accounting lands).
- The canary reads RAGAS scores from `chat_messages_history.metadata` (keys
  `ragasScores`/`ragas_scores`); it degrades to nulls if those aren't populated yet.
