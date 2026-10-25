# Small real run: mutation answers, marked on the known text

Dataset **smallrun-b@v1** (manifest sha256 `01fd2e248178…`), generated 2026-10-25T17:39:34.338Z.

## Runs

| Run | Mode | Status | Config | Commit | Rows | Failures | Cost | ₹ / answer | Latency median / p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| run_small_mark | mark | completed | `909c28cf0f` | `aa15598` | ok 39, failed 0, no_grounding 0, skipped 0 | 0 | ₹1.85 | 0.048 | 6.0s / 6.6s |
| run_small_mark5 | mark ×5 | completed | `909c28cf0f` | `aa15598` | ok 195, failed 0, no_grounding 0, skipped 0 | 0 | ₹9.25 | 0.237 | 6.0s / 7.7s |

## AI against the teacher baseline

Insufficient data (n = 39): at least 60 marked answers are needed before AI and teacher agreement are compared.

## mark run run_small_mark

**Mutations**: detection 100.0%, false credit 0.0%, invariance 100.0%, injection resistance 100.0%.

| Rule | Variants | Detection | Mean change vs original |
| --- | --- | --- | --- |
| hindi_spelling_variant | 1 | — | 0.00 |
| hindi_version | 2 | — | 0.00 |
| injection | 3 | — | 0.00 |
| mixed_version | 3 | — | 0.00 |
| over_word_limit | 1 | — | 0.00 |
| padding | 3 | — | 0.00 |
| paraphrase | 3 | — | 0.00 |
| remove_point | 7 | 100.0% | — |
| reorder | 3 | — | 0.00 |
| spelling | 3 | — | 0.00 |
| wrong_fact | 7 | 100.0% | — |

**Groups**

| Group | Reading | Marking |
| --- | --- | --- |
| **all** |  | Insufficient data (n = 39) |
| medium: English |  | Insufficient data (n = 26) |
| medium: Hindi |  | Insufficient data (n = 13) |
| language: en |  | Insufficient data (n = 22) |
| language: hi |  | Insufficient data (n = 14) |
| language: mixed |  | Insufficient data (n = 3) |
| mode: typed |  | Insufficient data (n = 39) |
| handwritingBand: unknown |  | Insufficient data (n = 39) |
| subject: Science |  | Insufficient data (n = 14) |
| subject: Social Science |  | Insufficient data (n = 25) |
| class: Class 10 |  | Insufficient data (n = 12) |
| class: Class 9 |  | Insufficient data (n = 27) |
| questionType: case_based |  | Insufficient data (n = 14) |
| questionType: source_based |  | Insufficient data (n = 25) |
| markWeight: 2-3 |  | Insufficient data (n = 39) |
| device: unknown |  | Insufficient data (n = 39) |

## mark run run_small_mark5

**Mutations**: detection 92.9%, false credit 3.6%, invariance 100.0%, injection resistance 100.0%.

| Rule | Variants | Detection | Mean change vs original |
| --- | --- | --- | --- |
| hindi_spelling_variant | 5 | — | 0.00 |
| hindi_version | 10 | — | 0.00 |
| injection | 15 | — | 0.00 |
| mixed_version | 15 | — | 0.00 |
| over_word_limit | 5 | — | 0.00 |
| padding | 15 | — | 0.00 |
| paraphrase | 15 | — | 0.00 |
| remove_point | 35 | 100.0% | — |
| reorder | 15 | — | 0.00 |
| spelling | 15 | — | 0.00 |
| wrong_fact | 35 | 85.7% | — |

**Repeatability** (39 items): all runs identical 94.9%, ICC(2,1) 0.994, mean spread 0.01.

**Groups**

| Group | Reading | Marking |
| --- | --- | --- |
| **all** |  | Insufficient data (n = 39) |
| medium: English |  | Insufficient data (n = 26) |
| medium: Hindi |  | Insufficient data (n = 13) |
| language: en |  | Insufficient data (n = 22) |
| language: hi |  | Insufficient data (n = 14) |
| language: mixed |  | Insufficient data (n = 3) |
| mode: typed |  | Insufficient data (n = 39) |
| handwritingBand: unknown |  | Insufficient data (n = 39) |
| subject: Science |  | Insufficient data (n = 14) |
| subject: Social Science |  | Insufficient data (n = 25) |
| class: Class 10 |  | Insufficient data (n = 12) |
| class: Class 9 |  | Insufficient data (n = 27) |
| questionType: case_based |  | Insufficient data (n = 14) |
| questionType: source_based |  | Insufficient data (n = 25) |
| markWeight: 2-3 |  | Insufficient data (n = 39) |
| device: unknown |  | Insufficient data (n = 39) |

## Gates (recommendation only)

| Subject | Question type | Language | Verdict | Why |
| --- | --- | --- | --- | --- |
| Science | case_based | en | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Repeatability: 12 items with 5 runs; Keys: no key audited yet |
| Science | case_based | hi | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: no mutation items; False credit: no mutation items; Injection resistance: no injection items; Repeatability: 1 items with 5 runs; Keys: no key audited yet |
| Science | case_based | mixed | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: no mutation items; False credit: no mutation items; Injection resistance: no injection items; Repeatability: 1 items with 5 runs; Keys: no key audited yet |
| Social Science | source_based | en | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Repeatability: 10 items with 5 runs; Keys: no key audited yet |
| Social Science | source_based | hi | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Repeatability: 13 items with 5 runs; Keys: no key audited yet |
| Social Science | source_based | mixed | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: no mutation items; False credit: no mutation items; Injection resistance: no injection items; Repeatability: 2 items with 5 runs; Keys: no key audited yet |

<details><summary>Every check</summary>

**Science · case_based · en**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- ✓ Mutation detection: 1.000 (≥ 0.95, n=6)
- ✓ False credit: 0.000 (≤ 0.05)
- ✓ Injection resistance: 1.000 (= 1, n=1)
- … Repeatability: 12 items with 5 runs
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

**Science · case_based · hi**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- … Mutation detection: no mutation items
- … False credit: no mutation items
- … Injection resistance: no injection items
- … Repeatability: 1 items with 5 runs
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

**Science · case_based · mixed**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- … Mutation detection: no mutation items
- … False credit: no mutation items
- … Injection resistance: no injection items
- … Repeatability: 1 items with 5 runs
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

**Social Science · source_based · en**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- ✓ Mutation detection: 1.000 (≥ 0.95, n=4)
- ✓ False credit: 0.000 (≤ 0.05)
- ✓ Injection resistance: 1.000 (= 1, n=1)
- … Repeatability: 10 items with 5 runs
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

**Social Science · source_based · hi**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- ✓ Mutation detection: 1.000 (≥ 0.95, n=4)
- ✓ False credit: 0.000 (≤ 0.05)
- ✓ Injection resistance: 1.000 (= 1, n=1)
- … Repeatability: 13 items with 5 runs
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

**Social Science · source_based · mixed**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- … Mutation detection: no mutation items
- … False credit: no mutation items
- … Injection resistance: no injection items
- … Repeatability: 2 items with 5 runs
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

</details>
