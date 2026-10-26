# Library contract v2

The shared contract for the library hub's passages: the passage-id grammar, the Qdrant point id, the
Qdrant payload and the collection's shape. PDLMS is the source of truth and the only writer;
DigiClassroom, Book Buddy and Vidyaverse vendor this folder unchanged and read with it.

| File | What it is |
|---|---|
| `src/passage-id.ts` | The id grammar: regex sources, `parsePassageId`, `proseIdFor`, `sectionIdFor`, `summaryIdFor`, `splitPartId` |
| `src/point-id.ts` | `pointIdFor(workId, passageId)`, `previewPointIdFor(...)`, a dependency-free `uuid5` |
| `src/content-sha.ts` | `passageContentSha`: what "unchanged" means for the incremental re-index |
| `src/payload.ts` | `LibraryPayloadV2` (TS type) and its zod schema |
| `src/collection.ts` | Collection name, vectors and payload-index fields |
| `schema/payload.schema.json` | The payload as JSON Schema (draft-07) |
| `fixtures/` | Valid and invalid ids and payloads, reference point ids |
| `test/contract.spec.ts` | The contract test; runs in every repo that vendors the folder |
| `scripts/vendor.mjs` | Release, verify and copy, with hash checks |
| `RELEASE.json` | Version, namespace, per-file sha256 and the bundle hash |

## Passage ids

Ids come only from what the book prints and from SECTION markers, never from a position in the file.
A typo fix changes no id.

| Kind | Form | Example |
|---|---|---|
| Numbered block | `<book>:<ch>:<kind>:<printed number>` | `sci9-en:07:example:7.2`, `sci9-en:07:exercise:A2`, `sci9-en:01:group-activity:1` |
| Questions box | `<book>:<ch>:qbox:p<page>[-<b>]:<printed question>` | `sci9-en:07:qbox:p74:2`, `sci9-en:07:qbox:p74-2:1` (second box on p.74) |
| Unnumbered box (highlight, More to know, biography, unnumbered figure) | `<book>:<ch>:box:p<page>:<n>` | `sci9-en:07:box:p77:1` |
| Unnumbered practice prompt | `<book>:<ch>:prompt:p<page>:<n>` | `sci9-en:05:prompt:p55:1` |
| Footnote | `<book>:<ch>:footnote:p<page>:<mark>[+<mark>]` | `sci9-en:07:footnote:p75:*`, `sci9-en:01:footnote:p1:*+**` (two stacked footnotes) |
| Part of a split block | `<block id>#<part>` | `sci9-en:07:figure:7.3#2` |
| Prose | `<book>:<ch>:sec:<section number or slug>:<k>` | `sci9-en:07:sec:7.2:3`, `sci9-en:01:sec:chapter-opening:1` |
| Summary bullet | `<book>:<ch>:summary:<n>` | `sci9-en:07:summary:4` |

The grammar is the textbook-prep skill's (`scripts/contract.py`: `KINDS`, `KEY_RE`, `prose_ids`): the
skill writes block ids into each block header and lists prose ids in `ch<nn>_index.json`, and this
contract accepts every one of them (`fixtures/skill-ch01-ids.json` holds a real chapter's). It is a
little wider in places (any printed footnote mark, a sub-letter on any numbered kind), never narrower.

- `<book>` is the book pack's `book_code` (`[a-z0-9]+(-[a-z0-9]+)*`); `<ch>` is the chapter as two
  digits (`07`; three allowed).
- Numbered kinds are `example`, `activity`, `figure` (figures and graphs share the printed Fig.
  numbering), `table`, `exercise` (`A<q>` for Additional Exercises), `group-activity`. A new kind is a
  contract release; an unknown kind is refused, never guessed.
- `n`, `k`, `b` and `part` count from 1. For `box` and `prompt`, `n` counts that kind on that printed
  page in reading order; for `qbox` the last number is the printed question number.
- **Prose ids follow the skill's chunking**: a prose passage is one chunk as the skill's parser cuts it
  (a new chunk at every PAGE marker, heading, SECTION or SUBSECTION marker and typed block; chunks
  under 40 characters dropped), and `k` counts them within the section in file order. The engine must
  not re-pack prose, or its ids would not be the index's.
- **The section key** is the governing SECTION marker's number, or for an unnumbered section the slug
  of its title (`chapter-opening`, `what-you-have-learnt`; `untitled` before any marker). Prose of an
  unnumbered section has `section_no: null` in the payload. `sectionKeyFor(number, title)` makes it.
- A prose passage's parent is its section, id `<book>:<ch>:sec:<section key>` (not a passage id).
- Not passage ids: golden questions `<book>:<ch>:golden:<n>`, answers `<block id>:answer[:<part>]`.

Every app stores the `passage_id`. Nothing stores a point id.

## Point ids

`pointIdFor(workId, passageId)` = uuid5 of `<work_id>/<passage_id>` in the namespace
**`8fa6d651-f95a-49d8-a753-f3f06fc98958`** (generated once on 26 Oct 2026; changing it re-keys every
collection). `work_id` is the lowercase `library.work.id`. The same passage keeps its point id across
revisions, so a changed passage is re-embedded in place and every stored reference still resolves.

A passage embedded for review (`status: preview`) uses `previewPointIdFor(workId, passageId,
revisionId)`, uuid5 of `<work_id>/<passage_id>@<revision_id>`, so a preview never overwrites the live
point of the same passage.

## Payload

See `src/payload.ts` for field-by-field notes. There is **no board, class or domain**: placements
answer where a book is used. `text` is the book's words only; authored descriptions are embedded but
never put in `text`. Every reader must filter `status = live` (preview points are for the reviewer).

## Releasing and vendoring

```bash
node contracts/library-v2/scripts/vendor.mjs release                 # after changing anything here
node contracts/library-v2/scripts/vendor.mjs copy <repo>/<path>      # vendor into another repo
node <vendored path>/scripts/vendor.mjs verify <vendored path>       # in the other repo, e.g. in CI
cd backend && npx jest --config ../contracts/library-v2/jest.config.js   # the test, in the source
```

PDLMS's own copy is `backend/src/library/store/contract`, vendored like any other repo's (the backend's
Docker build cannot see this folder). A vendored copy is never edited by hand.
