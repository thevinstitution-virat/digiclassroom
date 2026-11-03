# The key service has no product caller: where it would go (report only, nothing built)

Phase 1b, task 5. The Evaluator's rule: a key comes from the official scheme, a passage given in the question, or the
textbook; a question without a fully supported key is marked by the teacher by hand
(`docs/hw-eval/stage1-design.md` §2.2 and decision 2). Today the product marks against the teacher's own model answer and
rubric, and `buildKey` is called only from the evals.

## Where marking would call the key service

Nothing in the product calls `buildKey` (`keys/service.ts:98`); its only callers are `eval/live-deps.ts`, `eval/runner.ts` and
the library-hub code. The places a call could go, in the order a question travels:

| Step | Where | What is there today |
|---|---|---|
| Authoring | `services/assignments.ts:177` `addQuestion`, `:254` `setRubric`, `:299` `draftRubric` | The teacher writes the question, the model answer and the rubric items; `draftRubric` asks a model to draft rubric items from **the teacher's model answer**, not from a source. |
| Publishing | `services/assignments.ts:140` `publishAssignment` | Warns (does not block) when a question has no marking scheme (`:148`) or the scheme does not add up to the question's marks (`:150`). |
| Job planning | `jobs/grade-handler.ts:49-58` `plan()` | Loads the question; if it has no rubric items the job ends with "no marking scheme: answers wait for the teacher". This is the existing "teacher marks by hand" path. |
| Building the grader's input | `pipeline.ts:17-31` `loadGradeQuestion` | Reads `hw_question` and the current `hw_rubric_item` rows into the `GradeQuestion` the grader gets (`prompts/grade.v1.ts:42-56`). The key would replace the rubric items here. |
| Queueing | `pipeline.ts:155-158` `gradeRulesThenQueue` | Queues a grade job only when the question has rubric items. |

What a `KeyRequest` needs, and where each field would come from (`keys/types.ts:293-311`): `questionText`, `marks`, `questionType` from
`hw_question` (the product's `very_short | short | long | essay` map onto the key types); `subject` from `hw_assignment.subject`;
`classLevel` from `institution_classes.level`. **Not stored anywhere today:** the medium (English or Hindi; `hw_question.language_hint` is the
nearest), a passage separate from the prompt (a teacher pastes it into the prompt), an official-scheme reference, and **whether the
question is a public textbook exercise or board-paper question** (`questionOrigin`, which the shared key library needs). Those are new
fields on `hw_question`.

## How a key and the teacher's rubric would interact today

They do not. The rubric is the marking basis (`hw_rubric_item`, versioned; an edit retires the old row and bumps
`hw_question.rubric_version`), the model answer is shown to the grader beside it, and the AI suggestion records the rubric
version it judged (`hw_ai_grade.rubric_version`). A key has the same shape (value points with marks, a kind and accepted
alternatives, `keys/types.ts:315-328`; the evals already convert a key into a `GradeQuestion` in `eval/runner.ts:122-143`), so
it fits the rubric table, but it also carries what the rubric does not: citations and a verification verdict per point. Three
conflicts to settle whatever the wiring:

1. **A teacher edit.** If the teacher edits a key-derived rubric, the result is no longer the verified key. The Evaluator's rule
   then says the question is no longer grounded.
2. **Disagreement.** A teacher's scheme that differs from the key (a different split of marks, an extra point) has no defined winner.
3. **Marks.** A key's points add up to the question's marks by construction; teacher schemes often do not (`assignments.ts:150` only warns).

## Which existing assignments would end up with no AI suggestion

By the rule, **a question gets an AI suggestion only if it is grounded**: an official scheme is looked up, the question carries its own
passage, or the textbook covers it (a Class 9–10 book in the content base for that class, subject and medium).

- Teacher-written questions with no official reference and no separate passage can only be grounded through the textbook, and only
  if the textbook covers them; the content base holds Class 9 Social Science and Class 11 Physical Geography today. Everything else
  is `no_grounding` ("no_book").
- Passage-type questions (case, source, reading) have their passage inside the prompt text, which the key service cannot tell
  apart from the question until a passage field exists (`keys/service.ts:121` fails them as `missing_passage`).
- Rule-marked answers are unaffected: blank answers and exact matches against accepted answers need no key.

Counts, from the local development databases (read-only queries; **I did not query production**): in `digiclassroom` (dev), 6 assignments and 17
questions, all 17 with a teacher rubric and model answer; **under the rule none of the 17 would have an AI suggestion** unless
they are textbook exercises that are tagged as such, and none is tagged because the tag does not exist. In the integration database,
137 assignments and 274 questions are test fixtures. Production has no tenant using the feature (`HW_FEATURE_DEFAULT_ENABLED=false`,
no `hw_tenant_quota` rows as of the 25 Oct notes), so no live assignment is affected today; the effect is on what the pilot can
mark with AI at all.

## Ways to wire it in

**A. Key as the rubric, at authoring (draft, then gate).** On `draftRubric`/publish, build a key for every question that has the
fields; if grounded and fully supported, fill the rubric with its value points, mark the question `ai_marking = true`, and keep the citations. The
teacher can still edit; an edit sets `ai_marking = false` unless the key is re-verified. Others stay hand-marked.
*For:* the cost is paid once per question at authoring, the rule is enforced where the teacher can see it, the shared library
amortises it across tenants, and nothing changes in the marking hot path. *Against:* new columns on `hw_question` (origin, medium,
passage, `ai_marking`) and a migration; teachers lose AI marking when they edit a scheme; coverage is the two ingested books until
the Class 9–10 books arrive, so most questions are hand-marked at first.

**B. Key as a check on the teacher's rubric (advisory).** Keep marking against the teacher's rubric, build the key where one can be
grounded, and show the teacher the points the textbook has that the rubric lacks (and the reverse). AI suggestions continue for every
question with a rubric. *For:* least disruption, real value as quality control, and it lets the pilot measure how often teacher
schemes and sources disagree. *Against:* it does **not** enforce the Evaluator's rule (an ungrounded question is still AI-marked), so
the gate table cannot be claimed for it; it needs the same new columns.

**C. Strict gate at marking time.** In `plan()` (`jobs/grade-handler.ts:49`), require a stored, fully supported key for the question, and
use it instead of the rubric; no key, no AI. *For:* the strongest guarantee, and the rule holds even if authoring is bypassed (an
imported assignment, an API call). *Against:* the key must be stored and versioned per question (a new table such as
`hw_question_key`), a missing key silently turns AI off for a whole class unless the overview says why (the batch-status work in this
branch shows how), and with today's content base AI marking would almost never run.

A hybrid is likely: **A** to build and store keys at authoring, with **C**'s check at marking time as the backstop, and **B**'s diff view
for questions the textbook does not cover. The decision that comes first is the policy question under all three: whether a
teacher-written question the sources cannot ground may still get an AI suggestion, labelled as "against your scheme, not verified" and
kept out of the Evaluator's gates. The design said no (decision 2); every option above assumes that stays the answer.
