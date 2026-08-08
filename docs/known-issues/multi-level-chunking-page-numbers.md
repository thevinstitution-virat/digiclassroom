# Known issue: multi-level chunking loses page numbers

**Status:** deferred, deliberately. `ENABLE_MULTI_LEVEL_CHUNKING` is **off** in
production (`apps/api/.env.example:128` ships it `false`, and it is unset on
`digiclassroom:backend`, which resolves to the same thing via
`packages/core/src/lib/config/feature-flags.ts`).

**Why it is off:** the multi-level chunker drops `page_start` / `page_end`, and
page fidelity is non-negotiable — both iTutor and Varta enforce textbook
citation in their prompts, and a citation without a page number is not a
citation. Losing pages to gain parent/child retrieval is a bad trade, so the
flag stays off until the cause below is fixed.

## Cause

`enhanced-rag-pipeline.ts` (multi-level branch) concatenates the batch into one
string before chunking:

```ts
const fullText = batchChunks.map(c => c.text).join('\n\n');
const multiLevelResult = await multiLevelChunker.chunkText(fullText, { ... });
```

Page numbers live on the **per-chunk metadata** of `batchChunks`. The join
discards that metadata and produces a single anonymous blob, so every chunk that
comes back out — atomic, paragraph, and section — has no page provenance to
recover. The chunker isn't losing the numbers; the caller throws them away
before the chunker ever sees them.

The subsequent `chunk_level: 'atomic' | 'paragraph' | 'section'` tagging is
metadata *about hierarchy* only, and never restores page information.

## Likely fixes, in preference order

1. **Chunk within page boundaries.** Run the multi-level chunker per page (or per
   contiguous page range) rather than over the whole concatenated batch, so every
   produced chunk inherits the page(s) it came from. Costs more chunker calls;
   keeps provenance exact and needs no reconciliation.

2. **Carry page ranges up through the hierarchy.** Chunk the batch as today, but
   pass an offset→page map alongside `fullText` and, for each returned chunk,
   resolve its character span back to the page(s) it covers — `page_start` = page
   of the first character, `page_end` = page of the last. A parent spanning pages
   41–43 then reports exactly that. More bookkeeping, but it preserves the
   single-pass chunking the current code is built around.

Option 1 is simpler and harder to get subtly wrong. Option 2 is better if
section-level chunks are expected to span pages routinely, which for textbooks
they will.

## When this is fixed

The `level` payload field is **already being written** (`level: 0` on every
point, see the trio block in `indexChunksInQdrant`) precisely so this can land
without a query-side change: PDLMS/Varta filters `level = 0` to retrieve leaves,
and parents can start arriving as `level: 1` whenever the chunker is ready.
Until then everything is a leaf, and the filter still matches.

Also note `content.content_chunk` has no `parent_chunk_id` / `level` columns yet
— they were left out of trio migration `001` on purpose, since adding columns
nothing writes is how schemas rot. They go in with the fix.
