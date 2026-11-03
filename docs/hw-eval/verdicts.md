# Verdicts of strict marking (draft for the teachers to confirm)

Phase 1d. The strict profiles (`M0-strict`, `M1-strict`, prompt `grade-strict.v2`) do not give marks. For every answer and every key point
the model returns **exactly one verdict** and the **verbatim words** it relied on. Code turns the verdict into marks
(`grader/partial-credit.ts`), and only the third verdict depends on a rule that the teachers set.

**These definitions are a draft.** The wording below is what the model is given. Two teachers should confirm or change it, using the
person-check sheet (`docs/hw-eval/person-check/heldout-1d-v1/`) and the decision kit (`partial-credit-decision.md`).

## The four verdicts

| Verdict | Meaning | Marks |
|---|---|---|
| `same_fact` | The answer states the key point's fact, and every specific the key point gives (a number, a unit, a name, a place, a direction, an amount, more or less, open or closed, a cause, a kind of thing) matches. Wording, paraphrase, spelling, grammar, script and Hindi-English mixing do not matter. | the point's full marks |
| `right_idea_wrong_detail` | The answer states the key point's central idea or mechanism correctly, and **exactly one** detail around it is wrong: a number, a unit, a name, an example, or a secondary relation (how often, how much, a side effect). The test: if that one detail were corrected, the answer would be `same_fact`, and the central claim is true as written. | set by `HW_PARTIAL_CREDIT_RULE` |
| `different_fact` | The answer talks about what the key point is about, but contradicts it or replaces its central fact (the opposite, the wrong substance, the wrong cause), or several details are wrong so that no central idea is left. Naming the subject without stating the fact is `different_fact` if the answer says something else about it. | 0 |
| `absent` | The answer says nothing about what the key point is about. | 0 |

## Examples

Passages and key points are in `smallrun-b@v1` (the phase 1b smoke set) unless the line says `heldout-1d`. The "student" answers were
written by a program, not by students.

**`same_fact`**
1. Key point: *Plant B was kept in a cupboard with the door closed (got no or less sunlight).* Answer: "Plant B was kept in a cupboard with the door closed, so it got little or no sunlight unlike Plant A which was near the window."
2. (Hindi) Key point: *किसान गेहूँ की फसल की सिंचाई कर सके।* Answer: "तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई कर सके।"

**`right_idea_wrong_detail`**
1. (Hindi) Same key point. Answer: "तालाब में पानी रहने से किसान **धान** की फसल की सिंचाई कर सके।" Pond water irrigating a crop is right; the crop (wheat → rice) is the one wrong detail.
2. `heldout-1d`. Key point: *An ambulance could reach the village in fifteen minutes.* Answer: "An ambulance can now reach the village in **thirty** minutes, so sick people get help quickly." The idea is right; the number is wrong. (The smoke sets hold only one clean single-detail case, example 1, so the second example comes from the new near-miss variants.)

**`different_fact`**
1. Key point as in `same_fact` 1. Answer: "Plant B was kept in a cupboard with the door **open**, so it got **plenty** of sunlight." It says the opposite of the key point.
2. Key point: *Plants take in carbon dioxide to make their food.* Answer: "Plants take in **oxygen** from the air to make their food by photosynthesis." The wrong gas is the central fact.

**`absent`**
1. Key point: *Plants take in carbon dioxide to make their food.* The answer has only two sentences: the cupboard and the weekly watering. Nothing about a gas.
2. Key point: *It collects milk twice a day … fair price paid every ten days.* The answer says only that the cooperative gives cattle feed and runs a camp. Nothing about collecting or selling milk.

## Where the line is drawn, and what is not decided

- **One detail or several.** The draft says exactly one. In the smoke set the dairy-cooperative answers change three or four details of one point (how often, what is done to the milk, who buys it, when payment comes) or two details of the other (cost and who pays for the camp). Under the draft these are `different_fact`, though a teacher might call them a right idea. The decision kit lists them with a ◆ so the teachers can say.
- **When the changed detail is the answer.** "Which animal did the pesticide first collect in? Small birds" (key: small insects) is one word changed, but that word is what the question asks. A model may read it either way; the draft treats it as `different_fact`.
- **What `right_idea_wrong_detail` earns** is not decided here. `HW_PARTIAL_CREDIT_RULE` takes `zero` (the default: phase 1c's marks exactly), `half` or `full`; `HW_PARTIAL_CREDIT_BY_SUBJECT` can set it per subject, for example `{"science":"half","hindi":"full"}`. `half` is half the point's marks, rounded **down** to a half mark (teachers mark in half marks), so a 1-mark point earns 0.5, a 1.5-mark point 0.5, and a 0.5-mark point cannot be halved and earns 0.
- Whatever the rule, `same_fact` and `right_idea_wrong_detail` both need the quoted words to be in **that answer's own text**; otherwise the point is not credited and the answer's confidence drops (the evidence rule of phase 1c).

## How verdicts are stored

Every strict suggestion keeps, on each key point of `hw_ai_grade.items` (a jsonb column, so no migration): `fact` (the verdict), `claimed` (the quoted words as the model returned them) and `evidence` (whether they are in the answer's own text). The eval runner keeps the same three fields on every marked row. So the marks under any rule can be recomputed without a model call:

```
npm run hw:eval:rules -- --runs-root ../../hw-evals/cost1d/runs --datasets-root ../../hw-evals/datasets --label phase1d
```

With the rule on `zero`, a `right_idea_wrong_detail` is marked exactly as a `different_fact` is (marks 0, the words kept for the teacher when they are in the answer), which is what phase 1c did for every non-`same_fact` verdict. `partial-credit.test.ts` checks this over every combination of the three phase 1c verdicts, with and without evidence.
