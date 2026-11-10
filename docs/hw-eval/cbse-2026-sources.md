# CBSE Class X Science (086): the 2026 board papers, the official marking scheme and a real answer book

Read 11 Nov 2026 from the owner's copies in `C:\Users\thevi\Downloads\Compressed` (board documents: they stay out of git, like the
sample-paper bank under `hw-evals/`). This note records what they are, what they confirm about the product, and what they show it
does not yet do. No paper text is copied here.

## 1. What there is

| Files | What | Text layer | Matching scheme here |
|---|---|---|---|
| `Science-paper/1190-1..3_31-4-1..3_Science.pdf` | Main exam 2026, sets 31/4/1-3 (series LN4MK), bilingual, 32 pages each | yes | **yes**: `Revised Marking Scheme X_086_31.4 ALL ENGLISH.pdf` covers all three sets (36 pages) |
| `Science-paper/31-2-1..3.pdf`, `31-3-1..3.pdf` | Main exam 2026, sets 31/2 (LMNK2) and 31/3 | yes | no |
| `Science-paper/1191-1..3_31-5-1..3_Science.pdf` | Main exam 2026, sets 31/5 | yes | no |
| `Science-paper/31_1_1..3_Science.pdf` | Main exam 2026, sets 31/1, 24 pages each | **no (scanned)** | no |
| `Science-qp/31-7-1..3_Science_E2_May 2026.pdf` | **Second board exam (E2), May 2026**, sets 31/7 | yes | no |
| `Science-qp/31-8-1..3_Science_E2_May 2026.pdf` | E2 May 2026, sets 31/8 | **no (scanned)** | no |
| `Science-paper/31(B)-Science for V.I..pdf`, `Science-qp/31_B_ Science for V.I._E22026.pdf` | Visually impaired papers, main and E2 | yes | no |
| `Science-answer .pdf` | **A real handwritten answer book, already marked by a CBSE examiner** (red ticks and marks): 31 written pages, scanned flat. It is a **2025** script (old pattern: sections A-E, 20 mixed multiple-choice questions first), so none of the 2026 papers above is its question paper | no (scanned) | no: its 2025 paper and scheme are not here |

So: **3 sets (31/4/1-3) are complete enough to become bank papers today** (question paper + official scheme). The other 18 papers
are questions without a key.

## 2. The 2026 pattern (all sets agree)

- 39 questions, 80 marks, 3 hours, 15 minutes' reading time.
- **Three sections by subject**: A Biology (30 marks), B Chemistry (25), C Physics (25). The paper tells candidates to **divide the
  answer sheet into the three sections and never mix answers between them**. Our printed answer sheet already carries a section per
  block (`sheet.ts`), so it fits.
- Multiple choice and assertion-reason (1 mark), very short (2), short (3), case-based with three sub-questions (4), long (5).
- **9 internal choices per set, 3 per section** (`OR`), whole-question or within a part. The visually impaired version is a
  separate paper, not boxes inside the main one (the 2026-27 sample paper had them inline).
- From 2026 there are **two board exams** (the May "E2" sitting). A package for 2027 boards can carry both kinds of past paper.

## 3. What the official scheme says about marking, against what the product does

| The scheme's instruction | The product today | Gap |
|---|---|---|
| Marks only from the value points; the student's own wording is fine if correct (instructions 3-4) | `grade-strict.v2` judges each value point; wording, spelling and grammar never matter | none |
| An answer that is correct but **not in the scheme** (newer knowledge, "any other suitable", competency-based questions) still earns the marks (3) | judged only against the key's wording ("Do not reward what they might have meant"); "also accept" lines are the only way to widen it | **yes, for open points.** `Any other suitable food chain`, `any other difference`, `any other relevant point` appear across the three sets; the bank's "any N of M" slots cover listed choices, not an open "any other". Needs a value-point flag (open/example) and a measured prompt rule; until then such points must go to a person or be measured as their own group |
| `a / b / c` inside a value point = any one of them | the bank keeps it as one point whose quote holds all three; the model is told nothing special | small: make the slashes "also accept" wordings when building the bank file, so the model sees them as alternatives |
| **No marks deducted for the cumulative effect of an error: penalise it once** (10) | the strict prompt judges every point on its own; a later step that correctly uses an earlier wrong number is not "same_fact" | **yes, for numericals.** The evaluation already *expects* this (`eval/mutations.ts`, the `numeric_arithmetic` mutation: "error carried forward penalised once"), but nothing in marking does it, and no numerical has been measured. Fix belongs in code (step order is known from the key), then measured, before any numerical is AI-marked |
| An **extra question** answered (both alternatives of a choice): keep the better one, score out the other (9) | 5a places each alternative where its letter says, so both would be marked; one with no letter goes to review | phase 6 must count each `choice_group` once **at the higher mark**, never the sum (`attainableMarks` already counts the group once for the maximum) |
| Deductions written into the scheme: "deduct ½ for not showing direction of ray", "deduct ½ for no/incorrect balancing" | value points are additive only | small: write each deduction as its own ½-mark value point when building the bank file (e.g. "direction of ray shown"), so a missing one loses exactly that |
| Diagrams, ray diagrams, Punnett squares, circuit redrawings carry marks | drawings are not AI-marked; the bank keeps them as `excluded` and InkBuddy offers only the markable marks | stays as it is: a drawn part goes to a person in an exam too, and the report must say which marks are waiting |
| Every part assessed; totals carried correctly (13, 15, 17) | code adds the marks; an unplaced or unreadable answer goes to review, never silently to zero | none |

## 4. What the real answer book is good for

- It is the first **real handwriting** in this work: Indian-school cursive with crossings-out, insertions above the line, chemical
  equations, a Punnett-style working, ray diagrams, circuits, labelled apparatus and a table, on ruled paper with show-through from
  the back of each sheet. It can measure **reading accuracy** now, which phase 5a could not (its pages were drawn on screen).
- Limits: it is a **flatbed scan**, not a phone photo (no perspective, shadow or blur), and it has the **examiner's red ticks and
  numbers on it**, which a learner's photo will not. A reading run must check that marks in the margin are not transcribed as the answer.
- With its **2025 question paper and marking scheme**, it would also give a CBSE examiner's mark for every answer: a real
  comparison for our marking (one examiner's marks, so not the two-teacher blind marks the eligibility gate asks for, but real ones).

## 5. What would make more of this usable

1. **The marking schemes for 31/1, 31/2, 31/3, 31/5 (main 2026) and 31/7, 31/8 (E2 2026).** CBSE publishes each set's scheme; with
   them, 18 more papers become bank papers.
2. **The 2025 question paper and scheme for the answer book** (its set code is on the book's cover page, which is not in the scan).
3. More answer books of the same kind (CBSE publishes several each year), ideally a few photographed on a phone as a learner would.
4. Rights: the scheme is printed "Strictly Confidential"; CBSE releases the schemes publicly after results, but whether the
   product may show past-paper text and figures to paying learners is still the owner's question (exam-packages.md section 6).

The scanned papers (31/1, 31/8, the answer book) can be read from page images here; no outside processing is needed for them.

## 6. The board's own documents for 2026-27 (2027 boards)

All on `https://cbseacademic.nic.in/` (the portal's "Curriculum 2026-27" tab is `curriculum_2027.html`; sample papers are
`sqp_classx_2026-27.html`). Prefix each path below with that address.

| What | Path |
|---|---|
| Class X Science (086) curriculum: unit marks, chapters, formative-only topics, question-paper design | `web_material/CurriculumMain27/SecPart1/Science_SecP1_2026-27.pdf` |
| Its reading material (the formative-only chapters' NCERT text) | `web_material/CurriculumMain27/SecPart1/Science_SecP1IX_2026-27_RM.pdf` |
| Class X Mathematics / Social Science / English (Language and Literature) | `.../SecPart1/Maths_SecP1X_2026-27.pdf`, `.../SocialScience_SecP1X_2026-27.pdf`, `.../English_LL_SecP1_2026-27.pdf` |
| Initial pages (general scheme of studies) | `.../SecPart1/Curriculum_SecP1_2026-27.pdf` |
| Class X sample papers and marking schemes 2026-27 | `web_material/SQP/ClassX_2026_27/Science-SQP.pdf` and `Science-MS.pdf`; likewise `MathsStandard-`, `SocialScience-`, `EnglishL-` |

Class XII lives on the same tab (Senior Secondary); not looked up yet.

**What the Science curriculum says, and what is built from it** (`packages/core/src/lib/hw/exams/blueprint.ts`, read from the PDF
above on 11 Nov 2026): units I Chemical Substances 25, II World of Living 25, III Natural Phenomena 12, IV Effects of Current 13,
V Natural Resources 5 (80; internal assessment 20). Units II and V are the paper's Biology section (30), I is Chemistry (25), III and
IV Physics (25), which is the split the 2026 papers print. **Assessed only formatively** (in the syllabus, not in the year-end paper):
Periodic Classification of Elements; Evolution (acquired and inherited traits, speciation, fossils, human evolution); Motor,
Electromagnetic Induction, Electric Generator. Also not assessed: the colour of the sun at sunrise and sunset; information in NCERT's
boxes; derivations of the mirror and lens formulae. None of the 15 text-layer 2026 papers asks any formative-only topic.

- A **mock** in a CBSE Class 10, 2027 package (Science 086) cannot be published with a question, or a half-syllabus scope, on a
  formative-only chapter. Words in a written question that point to one ("generator", "Mendeleev", "fossil"; never "motor neuron")
  are a warning, as are a chapter that is not one of the curriculum's, and marks per unit that differ from the board paper's once
  every question has a chapter. Board papers (PYQ, sample paper) are the board's own and are not checked.
- The builder suggests the curriculum's 13 chapter names in every chapter field and links the curriculum it checks against.
- For the phase 6 report, `studyPriorities` ranks units by **board marks at stake**: the unit's marks in the board paper times the
  share lost in the attempt (half of a 25-mark unit lost, 12.5, comes before all of a 5-mark unit, 5).
- Only Science 086 for 2027 is in. Each further subject is added from the board's own curriculum PDF, never from a third party's summary.
