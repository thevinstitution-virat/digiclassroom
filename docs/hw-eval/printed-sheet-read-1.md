# Reading the printed answer sheet box by box (12 Nov 2026)

Learners will send a mix of printed answer sheets and plain paper (owner, 12 Nov). This adds a path for printed-sheet pages in which code does
the parts code can do exactly, and the reader model only transcribes. Plain paper keeps the half-page path and the checks of
[`real-handwriting-read-1.md`](real-handwriting-read-1.md); a sheet page code cannot square up falls back to it.

## What was built

- **One geometry for paper and code** (`exams/sheet-geometry.ts`): every block, box and letter bubble of a sheet page in millimetres. The print
  screen (`AnswerSheet.tsx`) now draws every block at those positions, so the printed sheet and the reading code cannot drift apart.
- **A page-identity strip**: 38 small squares between the two top corner marks spell the sheet code (24 bits) and page number (6 bits) with a
  6-bit check. A single misread square never decodes to the right page (tested for every square); a blank strip never decodes.
- **Code reads the photo** (`exams/sheet-vision.ts`, pure, on raw pixels from `sharp`): finds the four corner squares (dark, square, filled, the
  largest such marks, one near each corner of the photo, making a page shape), straightens the photo onto the page at 8 px/mm (a homography),
  reads the strip, reads each multiple-choice row from the ink around each letter (the two least-inked letters are the row's usual level; a
  letter well above it is marked; two such letters = for a person), and finds the boxes with writing in them.
- **The reader only transcribes** (`prompts/exam-box-read.v1`, `exams/sheet-read.ts`): one call per box with writing, the box cut out at full
  size with its printed label beside it. The prompt adds two rules real handwriting showed were needed: a crossed-out word replaced by another is
  the replacement, and unreadable writing is [?], never what the answer ought to say. Empty boxes and the grid cost nothing. Extra pages (where
  learners write their own question numbers) are read like plain paper.
- **Wiring** (`evaluate.ts`): `HW_EXAMS_SHEET_VISION` (default on) tries this first for every page; a page of another set's sheet, or one
  without readable corners or strip, is read the `HW_EXAMS_READ_SPLIT` way (halves by default) and the reason is kept with the page
  (`quality.read.sheetFallback`). Placement is unchanged: a box's question is certain, so no answer-key matcher call is needed.

## Test on phone-style photos of real handwriting

No learner has filled in a printed sheet yet, so the test sheet was made from real material: a 13-question mock (8 multiple choice, 5 written)
was created on the scratch database, its sheet printed to PDF by headless Chrome from the real print screen, and filled with **the real student's
handwriting** lifted from the 2025 answer book (examiner red ink removed; scaled to 64-79% to fit the boxes; faint ruled-line remnants left in). The
letters the student chose were marked in the grid (six circles, one tick, one filled bubble). Each page was then made into a phone-style photo:
on a table, tilted up to 3 degrees, in perspective, light from one side, a shadow band, blur, sensor noise, JPEG at 2400 px. Files:
`hw-evals/printed-sheet-read-1/` (git-ignored).

Same three photos, production settings (gpt-6-luna, OpenAI direct, reasoning low):

| | Box by box (2 runs) | Halves (1 run) |
|---|---|---|
| Pages found and identified by code | 3/3 | (the reader read the codes) |
| Grid letters right | **8/8, 8/8** (by code, free) | 7/8 (a filled bubble read as C) |
| Words in the boxes read right (290) | **95.5%, 93.1%** | 87.9% |
| Answers sent to a person | 0 | 2 (split at the seam, read with low confidence) |
| Answer-key matcher calls | 0 | 0 |
| Cost for the 3 pages | 17.3, 18.1 paise | 23.6 paise |

The crossed-out "pole" replaced by "optical centre" (whole pages read "pole" every time) was read right in both runs. What the box reader still
got wrong: "Coloumb" written as "Coulomb" (spelling does not change marks), a numerical's first line rearranged into an equivalent form, one
inserted "sine of" missed, and a clipped "(a)" at the edge of my pasted image read as "Q1)". Unreadable symbols came back as [?], not guesses.

**Cost** depends on boxes with writing, not pages: 3.5 paise a box on average here (2 paise for a 2-mark box, about 5 for a large one). A paper
with about 20 written answers would cost about Rs 0.70 to read at standard price (Rs 0.35 on batch), against about Rs 2.60 for 30 pages in halves.

## Limits

A composite, not a photograph of a sheet a learner filled in: the handwriting and its ink are real, the page geometry is the real print, the
photo effects are simulated. Handwriting was shrunk to fit, which makes it harder to read, not easier. One student, two runs. The corner search,
strip and grid thresholds are set on this test and the unit fixtures; they need real phone photos (curled paper, hard shadows, partial pages,
pencil) before they are trusted. Sheets printed before this change have no strip and are read the old way.

**Next:** a learner (or the owner) prints the sheet for a set, writes a paper by hand, photographs it on a phone, and those pages are run through
this path.
