# CHANGES_MANIFEST.md

Implementation pass against the confirmed paths/line numbers from the prior scan.
Written for a follow-up test/fix pass (Antigravity) — no tests were run or iterated on here.

**Typecheck:** source errors steady at **190 → 190** (zero regressions). Total moved
190 → 193, but all 3 additions are in `.next/types/app/api/practest/*/route.ts`
generated Next.js route-type stubs — build artifacts, not source, and not files this
change touched. Verified by counting `src/`+`scripts/`+`drizzle/` errors separately.

---

## Files modified

| File | Step | What changed |
|---|---|---|
| `src/components/ai/core/AnswerActionButtons.tsx` | 0a | Replaced diverging 95-line duplicate with a pure re-export of the canonical component |
| `src/lib/ai/rag/agent-retrieval-profiles.ts` | 0b | Added explicit `UI_AGENT_ID_TO_PROFILE_KEY` map; `getAgentRetrievalProfile` now throws instead of silently falling back to `explain_topic` |
| `src/lib/agents/conversational_learning_agent.ts` | 1 | Added hard-fail `else` branch for zero retrieval; derived `textbook_aligned`; fixed 7 literal-`\n` template literals and 3 double-escaped regexes |
| `src/lib/ai/answer-length.ts` | 2 | Added `language` param, `DEVANAGARI_TOKEN_MULTIPLIER` (1.5, provisional), `DEFAULT_ANSWER_LENGTH`, `resolveMaxTokens()`; split out `baseMaxTokens()` |
| `src/lib/agents/topic_explanation_agent.ts` | 2 | Threaded resolved language into directive + token budget; replaced `?? 1500` with tier-aware `resolveMaxTokens()` |
| `src/app/api/ai/chat/route.ts` | 3 | Widened semantic-cache gate to all 4 route types (strict threshold for `full-rag`); pre-gen cache no longer skipped when `subject` is absent; added `bypassCache` support |
| `src/components/ai/AnswerActionButtons.tsx` | 5, 7 | Added `board` enum guard (`toNoteBoardEnum`) + `chapter` to the notes POST; added "Explain Differently" button with 3 rotating angles and inline render |
| `src/components/ai/tutor/AgentSelector.tsx` | 6 | Added `suggestAgentForMessage()` + `AGENT_SUGGESTION_RULES` and a dismissible suggestion chip; dropdown remains the only thing that switches agents |

## Files created

| File | Purpose |
|---|---|
| `CHANGES_MANIFEST.md` | This file |

---

## ⚠️ Assumptions and corrected premises

Flagged per instruction. Several steps rested on premises that turned out to be wrong;
in each case I implemented against what the code actually does.

### Step 0b — the premise was wrong in a way that matters

`book_structure` does **not** resolve to `lets_talk`, **and** it does not silently fall
through either. The real situation is a third case: **the entire retrieval-profile
system is unreachable dead code.**

- `getAgentRetrievalProfile` is referenced only inside its own module.
- Its one consumer, `qdrant-search.ts:searchWithProfile` (line 1328), has **zero callers**.
- The live retrieval path is `src/lib/agents/core/services/retrieval.service.ts:searchRelevantContent`,
  which never consults `AGENT_RETRIEVAL_PROFILES`.

I added the explicit mapping and the throw as instructed, but **this changes no runtime
behaviour today.** Three of six UI ids were mismatched (`selfstudy_buddy`→`homework_help`,
`clear_doubts`→`doubt_clearing`, `book_structure`→`lets_talk`), so if the profile system is
ever wired up, it would have used Deep Dive's retrieval strategy for half the agents.
The mapping now prevents that. **Assumption:** I accept both UI ids and canonical profile
keys, since I could not determine which form a future caller would pass.

**Consequence to be aware of:** the function now throws. Nothing calls it, so nothing can
break today — but whoever wires it up must pass a mapped id or handle the throw.

### Step 3 — routing rationale (investigated, not assumed)

From `makeRoutingDecision` (`query-router.ts:286`) and `determineCacheStrategy` (line 265):

- `cached-template` — simple ≤5-word definition; cache-first by design.
- `semantic-cache` — simple, or moderate + cache-first; cache-first by design.
- `hybrid` — its own reasoning string reads *"Hybrid (cache + minimal RAG)"* (lines 319–326).
  **It was supposed to check the cache and never did.** That was the actual bug.
- `full-rag` — complex; `determineCacheStrategy` marks complex as `'rag-first'` with the
  comment *"low reuse, needs fresh context"*.

**Judgement call:** I read "needs fresh RAG context" as *not* equivalent to "must never
reuse an identical prior answer", so `full-rag` now checks the cache too — but behind
`minSimilarity: 0.95`, because a loose semantic match on a complex analytical question is
likelier to be subtly wrong than on a simple definition.

**Two assumptions here that need verification:**
1. I assumed `semanticCache.searchCache()` accepts a `minSimilarity` option. **I did not
   verify this against `semantic-cache-service.ts`.** It is passed via `as any`. If the
   option is ignored, `full-rag` gets the default threshold — it still gains the lookup,
   but without the intended stricter gate. **Please confirm.**
2. For step 6's pre-gen widening I read `routingDecision.intent.subject` via `as any` as a
   subject fallback. **I did not confirm `QueryIntent` actually carries a `subject` field.**
   If absent it is `undefined` and the call passes `null`, so behaviour degrades to the old
   skip rather than breaking — but the intended fallback would not work. **Please confirm.**

I kept `classLevel` as a hard requirement for the pre-gen lookup (rather than widening it)
because it participates in `generateQuestionHash` — serving a Class 12 answer to a Class 9
student is a correctness bug, not a weaker match.

### Step 5 — the button already existed

"Add to Sanchika" was **already fully implemented** (lines 385–575: dialog, folder
creation, append-to-existing-note as a new page, tags, enriched content with
translation/word-meanings/visual-aid, `source_type: 'ai_tutor'`, `source_query`). This was
not a missing feature. What was actually missing, and what I added:

- **`board` was never sent at all.** And the mismatch you predicted is real: the tutor
  session holds `EducationBoard` as lowercase `'cbse' | 'icse' | 'state_board'`
  (`_types/index.ts:105`), while `user_notes.board` is `ENUM('CBSE','ICSE','STATE_BOARD')`.
  `toNoteBoardEnum()` uppercases, converts spaces/hyphens to `_`, validates, and the key is
  **omitted entirely** when unmappable.
- **`chapter` was never sent**, though the column and the API both accept it.
- `class_level` now explicitly `String(...)`-coerced.

**Blocking gap — one line needed in an unlisted file:** `board` is a new optional prop and
**the call site does not pass it.** `src/app/dashboard/user/ai-tutor/page.tsx` (~line 456)
needs `board={conversationState.context.educationBoard}`. That file was not in scope, so I
did not edit it. **Until that line is added, board is still never persisted.**

**`source_answer` / `source_visualizations` are deliberately NOT sent.** The premise that
this is "just wiring since the columns exist" is true of the schema but **not** of the API:
`src/app/api/notes/route.ts` does not destructure either from the request body —
`source_answer` is hardcoded server-side to `content` (line 115) and
`source_visualizations` is never written on create. Sending them would be silently
discarded. Persisting them requires editing that route (out of scope).

### Step 7 — "next to Regenerate", but there is no Regenerate

I searched `src/components/ai` and `src/app/dashboard/user/ai-tutor`: **no Regenerate
button exists anywhere.** The button is placed at the end of the action row instead.

**Design decision:** this component does not own the tutor message list, so rather than
require a new parent callback (which would mean editing `page.tsx`, out of scope), it calls
`/api/ai/chat` itself and renders the alternative inline — the same pattern Translate and
Visual Aid already use. It sends `bypassCache: true` so a cache hit can't return the exact
explanation the student just rejected, and it passes the previous answer with an explicit
instruction not to reuse its structure or wording. Each press advances analogy →
real-world example → simpler vocabulary.

**Assumption:** I read the response as `data.response || data.answer || data.content`
because I did not confirm the chat route's exact success-payload key. One of the three
should hit; worth pinning down.

### Step 1 — an extra bug found in the same file

Beyond the 7 literal-`\n` template literals, `extractKeyTopics` (lines ~235–239) used
`\\s` and `\\*\\*` inside **regex literals**, matching a literal backslash rather than
whitespace/asterisks. No markdown heading could ever match, so `key_topics_discussed`
always returned empty. Same double-escaping root cause; fixed and commented.

Also note `textbook_aligned` feeds `fidelity` in `execute()` (1.0 vs 0.5), so the previous
hardcoded `true` was reporting false confidence downstream, not just a cosmetic flag.

### Step 2 — the multiplier is a guess

`DEVANAGARI_TOKEN_MULTIPLIER = 1.5` is **provisional and explicitly marked as such in
code**. Real Devanagari BPE overhead varies by tokenizer, and `buildLanguageDirective`
permits English technical terms to survive in Hindi output, which lowers effective
overhead by an amount I cannot predict. Verify empirically per model: generate in-band
Hindi answers at each tier and compare actual completion tokens to the ceilings. VSA
(120 base → 180 scaled) is the most truncation-prone.

---

## ❌ Not implemented

Stopped here deliberately rather than write large unverified features. Three steps remain:

### Step 4 — persistent topic-weakness signal (`tutor_topic_events`)
**Not started.** The largest item: new Drizzle table + generated migration + write path in
the chat route + an aggregation read path joining `practest_attempt_events` against
`practest_question_bank` + prompt injection into the "Ace Your Exams" persona.

Two blockers worth knowing before it starts:
- **Docker is not running**, so `drizzle-kit` cannot apply a migration and I could not
  verify generated SQL against the live schema. `drizzle-kit generate` works offline;
  `push`/`migrate` does not.
- The quiz-derived half needs a topic dimension on `practest_question_bank`. **I did not
  confirm that table has subject/chapter/topic columns** — my earlier scan of it returned
  no matches for `subject|chapter|topic|difficulty`, which suggests the join key for
  "topic-level weakness" may not exist yet. **This needs checking before the read path is
  designed**, or step 4 will only be able to aggregate doubt frequency, not quiz accuracy.

### Step 8 — vision-based diagram reading
**Not started.** Requires tracing the current image→OCR→text path for the tutor and
identifying a vision-capable provider call behind the `ILLMProvider` abstraction. I have
not read those files; guessing at the provider interface would produce plausible but
wrong code.

### Step 9 — low-data fallback mode
**Not started.** Needs the SSE streaming path (`/api/ai/stream`) and the multimodal upload
component identified and gated behind a mode flag, plus a decision on where the toggle
lives (user preference vs. session vs. auto-detected). The persistence location is a
product decision I did not want to assume.
