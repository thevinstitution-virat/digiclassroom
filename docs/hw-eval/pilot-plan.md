# Virat Evaluator: pilot plan

**Goal:** decide, per subject × question type × language, whether AI-suggested marks may be
shown (the gates in stage1-design.md §8), on real handwriting and real teacher marking, with
numbers that hold up. Teachers review every mark in every case; the gates decide only whether
suggestions are shown.

**Starting point (25 Oct 2026):** the measurement system, key service, evaluator tools,
shadow mode and monitoring are on `main` and in production, switched off; migrations 014 and
015 are applied. The small real run (small-run-report.md) showed the pipeline works and found
six things to fix or decide, listed under step 0.

## Scope

One or two partner schools, CBSE, **Class 9 and 10, Science and Social Science**, English and
Hindi medium: the subjects where the content base has books and the board format is closest to
what students already write. Question types: very short, short (2–3 marks), and
source/case-based. Long answers and numericals join once their keys can be grounded (step 0).

## Step 0: before any school (1–2 weeks, no students)

| # | What | Why |
|---|---|---|
| 0.1 | Ingest the Class 9–10 Science and Social Science books, **English and Hindi medium**, into Gyankosh; fix the medium filter in its search; remove the duplicate Class 9 SST book | Without them almost every board question is `no_grounding` |
| 0.2 | Calibrate `HW_KEY_R_MIN` (scripts/hw-key-calibrate.ts, on the server or through a tunnel), first with proxy labels, then with 60 hand-labelled question → passage pairs | Textbook keys refuse to run uncalibrated |
| 0.3 | Numerical keys: combine the question's passage with textbook retrieval for the formula and unit | Finding 1 of the small run |
| 0.4 | Decide how line breaks count in CER (a break read as a space) and set the read prompt accordingly | Finding 5 |
| 0.5 | Choose and freeze `regression@v1` from the first datasets below; record the production baseline run | Every later change is gated on it |
| 0.6 | Decide the partial-credit rule for "right idea, wrong detail" with two subject teachers, and write it into the mutation rules | Finding 3 |

## Step 1: reading, from people's writing (sources A and C)

- **Writers:** 10–15 adult volunteers (staff, teachers, student teachers), each copying 20–30
  known texts on the pad (`/evaluate/copy`) and on paper (copy sheets, then photographed).
  Mix of hands: neat, average, messy; left- and right-handed; English, Hindi, mixed.
- **Target:** ≥ 300 items per language, ≥ 100 per handwriting band, half pad and half paper.
- **Consent:** volunteers sign the volunteer form (`hw_eval_consent`, subject `volunteer`).
- **Then** source C: 200 real student answers from consenting classes, transcribed by two
  people each in the transcription tool, disagreements adjudicated.
- **Measure:** `read` and `e2e` runs; CER/WER/invented text per language, band, device and pad
  vs paper; escalation rate; cost per page.

## Step 2: keys (source F)

- Build keys for every question in the pilot assignments (key mode runs).
- A subject expert audits a random 20% (key audit tool), at least 30 keys per subject and
  medium. Gate: audit error ≤ 2%.
- Partly supported keys are never used for marking; questions without a grounded, fully
  supported key are marked by the teacher by hand (decision 2 of the design).

## Step 3: marking against the key (source B), then against teachers (sources D and E)

- **Mutation sets:** 30 questions × all rules, written by the mutation generator (another
  family from the grader), checked by a person (10% sample, min 20 per rule), copied by the
  step-1 writers, so marking is tested on real handwriting with known expected marks.
- **Teacher baseline (E):** two subject teachers per subject × medium mark the same 50–60
  answers blind in the blind-marking tool; adjudicated where they differ. This sets the bar the
  AI must reach (QWK lower bound ≥ teacher QWK − 0.03 and ≥ 0.80).
- **Previously checked copies (D):** 200 de-identified, consented answer copies with a
  teacher's marks, as a real-world check (never used alone to set a gate).
- **Repeatability:** a 5-run mark at production settings on 100 answers per subject.
- **Report:** `npm run hw:eval:report` on each dataset version; the gate table decides.

## Step 4: in the classroom, suggestions hidden

- Switch the feature on for the pilot classes (`hw_tenant_quota.enabled`, with a monthly
  quota) for 4–6 weeks of normal homework. Teachers mark with AI suggestions **only in
  subject × question type × language groups that are Eligible**; elsewhere they mark by hand.
- Shadow mode on (`HW_SHADOW_RATE` 0.1–0.2) for the next candidate configuration.
- Monitoring every day (`npm run hw:eval:live`): override rate and size, transcript fixes,
  misread flags per subject and question type. A rising override rate in an Eligible group
  sends it back to "Not yet" until a regression-gated fix.

## Data protection

- Only de-identified work reaches any AI provider; the de-identification tool runs on every
  photo before it is used (source D especially).
- Student work only with a parent's consent recorded; withdrawal removes the student's items
  from the next dataset version.
- Raters see each other only by pseudonym; reports and the public summary carry no item ids,
  names, or groups below the minimum size.
- Partner schools see their own monitoring only.

## Budget and people (estimates)

| Item | Estimate |
|---|---|
| AI for reading and marking ~5,000 items, plus 5-run repeats on 400 | ₹1,000–3,000 (the small run cost ₹0.05 per answer to mark and ₹0.15 to read and mark; real handwriting escalates more often) |
| Keys for ~300 questions | ₹100–200 |
| Volunteers' writing | 10–15 people × 2 hours |
| Transcription (C) | 400 transcriptions ≈ 20 hours |
| Blind double marking (E) | 2 teachers × 60 answers × 2 subjects × 2 media ≈ 16 hours |
| Key audit (F) | 1 expert per subject ≈ 6 hours |

## Exit criteria

- At least one subject × question type × language group **Eligible** on real data, with the
  teacher baseline from ≥ 30 double-marked answers in that group.
- Regression gate in place, baseline recorded, CI job configured.
- A pilot report (public summary + full report) for the partner schools.

If no group is Eligible, the report says which gate failed and by how much, and the next step
is the specific fix (reading, keys, or marking), measured on the same frozen datasets.
