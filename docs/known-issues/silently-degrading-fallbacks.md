# Pattern: the silently-degrading fallback

**This is a pattern to look for, not a single open bug.** It has been found three
times in this codebase in one week, each time in code that looked correct and
reported success.

## The shape

```ts
try {
  doTheGoodThing();
} catch (error) {
  console.error('X failed, falling back to Y:', error);
  return doTheLesserThing();   // ← works, so nobody ever investigates
}
```

The fallback is *reasonable*. That is exactly what makes it dangerous. The system
keeps returning plausible output, the error line scrolls past in a log nobody
reads, and the real mechanism is never exercised. There is no alarm, no failed
request, no metric that moves — only quietly worse behaviour that gets attributed
to the model, the data, or "RAG being fuzzy".

**A `catch` that degrades silently is a bug even when the fallback is correct.**

## Confirmed instances

| Where | What actually happened | How long |
|---|---|---|
| `qdrant-search.ts` hybrid search | Requested a sparse vector named `sparse` when the collection defines `bm25`, and passed `sparse_vector` to the legacy `search()` endpoint, which has no fusion step and rejects it. Every call threw and fell back to dense-only. **DCP's sparse index had never once been queried.** | Since hybrid search was written |
| `enhanced-rag-pipeline.ts` sparse generation | Used a term's array position within its own chunk as its sparse index, so no two vectors were comparable. Produced valid-looking vectors that matched nothing. | Same |
| Trio snapshot cron | Ran curl in a throwaway container; when a prune evicted the image, pull progress corrupted the captured JSON. Failed loudly only because it had been rewritten to check. Its predecessor would have silently backed up nothing. | Until rewritten |

## What to do instead

1. **Fail loudly on a mechanism failure, fall back only on a data failure.** "The
   sparse index is unreachable" is a bug; "this query has no sparse terms" is
   data. The first should raise, the second may degrade.
2. **Make the degraded path visible in the response**, not just the log — a
   `degraded: true` flag, a metric, something a caller can assert on.
3. **Prove the fallback is not permanently on.** If a code path can only be
   confirmed by reading the code, it is not confirmed. Capture the actual
   outbound query, or assert on a field only the good path produces.
4. **Never let a `catch` swallow a configuration mismatch.** Wrong vector name,
   wrong collection, wrong dimension — these are deploy-time errors wearing a
   runtime disguise, and they will never fix themselves.

## Review question

For any `try/catch` in a retrieval, ingestion or storage path, ask:

> If this catch fired on every single call from the day it was written, what
> would look different to a user?

If the honest answer is "nothing", the catch needs to raise, surface a flag, or
be covered by a test that asserts the good path ran.
