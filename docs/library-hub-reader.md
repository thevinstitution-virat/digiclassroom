# DigiClassroom reads the library hub (Phase 7)

PDLMS is the only writer of the shared library (`trio.library`, Qdrant `library_v2_te3l_3072`). DigiClassroom
stops ingesting books and reads the result. Everything here is **off by default**: with no flag set, DigiClassroom
behaves exactly as before. Nothing in this branch is deployed or applied anywhere.

## Flags and settings

| Setting | Effect |
|---|---|
| `LIBRARY_HUB_ENABLED=true` | Tutor, Virat Evaluator (answer keys) and Practest CASA read the hub. Read on every call, so no restart. |
| `LEGACY_INGESTION_DISABLED=true` | `POST /api/super-admin/content/ingest-markdown`, `/content/upload` and `/api/internal/trio-ingest` answer `410` and point to the PDLMS Library hub. The upload page shows that message. |
| `LIBRARY_HUB_URL`, `LIBRARY_HUB_SECRET` | PDLMS origin and this app's secret (PDLMS `HUB_CLIENTS` holds its SHA-256). `LIBRARY_HUB_APP_ID` defaults to `digiclassroom`, `LIBRARY_HUB_TIMEOUT_MS` to 8000. |
| `LIBRARY_QDRANT_URL`, `LIBRARY_QDRANT_API_KEY` (read-only), `LIBRARY_QDRANT_COLLECTION` | Optional direct reader, the tutor's fallback when the hub is down (below). Uses `OPENAI_API_KEY` for the query embedding. |
| `LIBRARY_READER_DATABASE_URL` | `dcp_library_reader` on `trio`: Practest import of the book's MCQs. |
| `LIBRARY_EVALUATOR_DATABASE_URL` | `dcp_library_evaluator`: adds `library.answer` (printed answers) to that import. Without it questions without a readable answer are listed, not imported. |

Order for production: roles and library migrations on `trio`, PDLMS `HUB_SEARCH_ENABLED`/`HUB_CLIENTS`, the book
loaded and approved in PDLMS, then these settings here, then `LIBRARY_HUB_ENABLED`. Phase 8 wipes the old data.

## What changes when `LIBRARY_HUB_ENABLED` is on

**Tutor** (`QdrantRAGSearch.search`, so every caller of it): the search goes to `POST /api/hub/search`.
`lib/library/tutor-adapter.ts` keeps the response shape the tutor reads and adds `passage_id`, `work_id`, the work
title (as `source`), the printed page and `pdf_page`. A hit comes with its neighbouring prose of the same section.
Scope: the learner's learning path (`libraryScopeForUser`: goal node ids and medium; the streaming route resolves it
per user) or, when the caller has only the old board and class, the class code (`SCH.CBSE.C9`, `SCH.CISCE.C10`).
With neither (a state board, no path) the answer is empty with `debugInfo.reason = 'no_scope'` and a warning; it never
searches every book. Cache keys (`vector_search:`, `rag:`) include the scope while the flag is on, so one learner's
cached passages are never served to another. Citations carry `passageId` (`NCERTCitation`, `SourceChunk`).

**Fallback** (`lib/library/search.ts`): only a hub *outage* (unreachable, timeout, 5xx) is covered, by a direct
read-only query of the library collection (`status = live`, public, reference, medium; dense only, no rerank). It
applies the scope the hub gave for the same goals on its last good answer, else every public book in the medium, and
says so: `degraded: true`, a warning in the response, `search_strategy = library_direct_degraded`. Wrong credentials
(401/403), hub search off (404), a refused request (400) and rate limits (429) are thrown: they are configuration, and
a fallback would hide them. The answer-key and CASA paths never use the fallback (it cannot apply a scope), so an
outage there is an error, not "no book".

**Virat Evaluator answer keys** (`lib/hw/keys/hub-retrieval.ts`, `KeyDeps.hub`): textbook retrieval from hub search
instead of the Gyankosh reads and `content.content_chunk`. Scope: `KeyRequest.library` (node ids/codes/work ids), else
the CBSE class and subject as curriculum codes (`SCH.CBSE.C9.SCIENCE` and its parts; class 10 mathematics is both
courses). Same rules as before: `HW_KEY_R_MIN` is a floor on the best passage's **dense cosine** (`score.dense`); a hit
without one is dropped; the book's own matching exercise anchors the chapter (practice passages come from the same
search); the writer sees only `text`, the book's words. Citations and `cites` are `passage_id`s (`chunkId`). The config
hash includes the hub index, so cached keys from the old index are not reused. `HW_KEY_PAGES_VERIFIED` must list hub
**work ids** from now on. R_min was calibrated on the old index: re-run `scripts/hw-key-calibrate.ts` after the reload.
In hub mode `bookHint.contentItemId` is a hub work id.

**Practest**
- CASA verify (`.../questions/[id]/verify-casa`): hub search scoped to the question's board, class and subject; the
  matched passage id is stored as `casaAnchor` (and the printed page as `casaPage` when empty). The threshold compares
  with the dense cosine.
- `POST /api/super-admin/practest/import-library` (`mode: validate | commit`, `workId`, optional `chapterNo`, `board`,
  `classLevel`, `subject`): the work's questions that print lettered options (`library.practice_item.choices`), options
  read back out of the printed text, the answer from `library.answer` when it is a single letter, `casa_anchor` = the
  block's passage id, page, book and edition. Board, class and subject come from the work's school placement or the
  request. Goes through the same validation, de-duplication and DRAFT insert as the CSV import
  (`lib/practest/commit.ts`, shared). Questions that cannot be read or have no usable answer come back in `problems`
  with the reason; nothing is guessed. **The parser has only been tested on invented text**: check a real chapter's
  validate output before committing anything.

**Legacy lanes** are switched off by `LEGACY_INGESTION_DISABLED` independently of the above.

## Contract

`packages/core/src/lib/library/contract` is the vendored library contract 2.1.0
(`node contracts/library-v2/scripts/vendor.mjs verify <path>` in PDLMS checks it). Never edit it by hand.

## Not done here

- Ingest tRPC content router and the `content.*` tables are still there; Phase 8 drops them with the wipe.
- Hindi books: scope carries `medium`; the answer-key scope assumes the CBSE board and English subject names.
- Stored passage ids in hw keys/Practest are written by the new paths; rows from before the wipe keep old chunk ids
  until Phase 8 removes them.
