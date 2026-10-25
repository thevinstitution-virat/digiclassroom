# Small real run: mutation answers, read then marked (synthetic images)

Dataset **smallrun-b@v3** (manifest sha256 `f100ce071613…`), generated 2026-10-25T17:39:36.765Z.

## Runs

| Run | Mode | Status | Config | Commit | Rows | Failures | Cost | ₹ / answer | Latency median / p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| run_small_e2e | e2e | completed | `909c28cf0f` | `aa15598` | ok 39, failed 0, no_grounding 0, skipped 0 | 0 | ₹5.84 | 0.150 | 267.2s / 293.8s |

## AI against the teacher baseline

Insufficient data (n = 39): at least 60 marked answers are needed before AI and teacher agreement are compared.

## e2e run run_small_e2e

**Reading**: CER 1.4% (graphemes 1.5%), WER 0.1%, median item CER 1.7%, [?] 0.0%, invented 0.1%, catastrophic 0.0%, n=39 — insufficient data.

**Effect of reading errors** on MAE (AI transcript − truth transcript): 0.013 [0.000, 0.038].

**Mutations**: detection 92.9%, false credit 3.6%, invariance 100.0%, injection resistance 100.0%.

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
| wrong_fact | 7 | 85.7% | — |

**Groups**

| Group | Reading | Marking |
| --- | --- | --- |
| **all** | Insufficient data (n = 39) | Insufficient data (n = 39) |
| medium: English | Insufficient data (n = 26) | Insufficient data (n = 26) |
| medium: Hindi | Insufficient data (n = 13) | Insufficient data (n = 13) |
| language: en | Insufficient data (n = 22) | Insufficient data (n = 22) |
| language: hi | Insufficient data (n = 14) | Insufficient data (n = 14) |
| language: mixed | Insufficient data (n = 3) | Insufficient data (n = 3) |
| mode: photo | Insufficient data (n = 39) | Insufficient data (n = 39) |
| handwritingBand: unknown | Insufficient data (n = 39) | Insufficient data (n = 39) |
| subject: Science | Insufficient data (n = 14) | Insufficient data (n = 14) |
| subject: Social Science | Insufficient data (n = 25) | Insufficient data (n = 25) |
| class: Class 10 | Insufficient data (n = 12) | Insufficient data (n = 12) |
| class: Class 9 | Insufficient data (n = 27) | Insufficient data (n = 27) |
| questionType: case_based | Insufficient data (n = 14) | Insufficient data (n = 14) |
| questionType: source_based | Insufficient data (n = 25) | Insufficient data (n = 25) |
| markWeight: 2-3 | Insufficient data (n = 39) | Insufficient data (n = 39) |
| device: synthetic-font | Insufficient data (n = 39) | Insufficient data (n = 39) |

## Gates (recommendation only)

| Subject | Question type | Language | Verdict | Why |
| --- | --- | --- | --- | --- |
| Science | case_based | en | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Repeatability: no 5-run repeat; Keys: no key audited yet |
| Science | case_based | hi | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: no mutation items; False credit: no mutation items; Injection resistance: no injection items; Repeatability: no 5-run repeat; Keys: no key audited yet |
| Science | case_based | mixed | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: no mutation items; False credit: no mutation items; Injection resistance: no injection items; Repeatability: no 5-run repeat; Keys: no key audited yet |
| Social Science | source_based | en | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Repeatability: no 5-run repeat; Keys: no key audited yet |
| Social Science | source_based | hi | **Not yet** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: 0.750 (≥ 0.95, n=4); False credit: 0.125 (≤ 0.05); Repeatability: no 5-run repeat; Keys: no key audited yet |
| Social Science | source_based | mixed | **Insufficient data** | Answers: n=0 (< 60); Teacher baseline: 0 double-marked (< 30); Marking agreement: needs the answers and the teacher baseline; Large errors: n=0; Mutation detection: no mutation items; False credit: no mutation items; Injection resistance: no injection items; Repeatability: no 5-run repeat; Keys: no key audited yet |

<details><summary>Every check</summary>

**Science · case_based · en**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- ✓ Mutation detection: 1.000 (≥ 0.95, n=6)
- ✓ False credit: 0.000 (≤ 0.05)
- ✓ Injection resistance: 1.000 (= 1, n=1)
- … Repeatability: no 5-run repeat
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
- … Repeatability: no 5-run repeat
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
- … Repeatability: no 5-run repeat
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
- … Repeatability: no 5-run repeat
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

**Social Science · source_based · hi**

- … Answers: n=0 (< 60)
- … Teacher baseline: 0 double-marked (< 30)
- … Marking agreement: needs the answers and the teacher baseline
- … Large errors: n=0
- ✗ Mutation detection: 0.750 (≥ 0.95, n=4)
- ✗ False credit: 0.125 (≤ 0.05)
- ✓ Injection resistance: 1.000 (= 1, n=1)
- … Repeatability: no 5-run repeat
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
- … Repeatability: no 5-run repeat
- – Medium gap: only no data
- – Handwriting gap: only no data
- … Keys: no key audited yet

</details>
