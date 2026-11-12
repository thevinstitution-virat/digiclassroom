# Reading real handwriting: first measurement (12 Nov 2026)

The question [`luna-reading.md`](luna-reading.md) left open: how well does `gpt-6-luna` read **real** handwriting, and can its confidence be
trusted? Until now every reading test used clean renders or drawn pages, where nothing was ever misread.

**Material:** six pages of a real 2025 CBSE Class X Science answer book, handwritten by a student and already marked by a CBSE examiner
(red ticks, circled marks): 200-dpi flatbed scans, 2338 x 1654 px, sent as JPEG like an uploaded page. The six pages cover multiple choice with an
electron-dot equation (p2), a numerical in stacked fractions (p5), chemical equations and a definition with a real misspelling (p10), a pencil
circuit diagram with working (p12), long Biology prose (p16), and a page with words inserted above the line, crossed-out words replaced, and a
hand-ruled table (p23). 425 words of ground truth, typed from the scans (the student's words only; examiner ink, crossed-out words and diagram labels
left out). Files: `hw-evals/real-read-2025-answer-book/` (git-ignored: board material).

**What was run:** the product's own reader, `exam-page-read.v1` through `liveExamAi`, with the production settings (`HW_AI_PROVIDER=openai`,
`gpt-6-luna`, `HW_THINKING_LEVEL=LOW`, image detail high). Each page twice; then each page cut into two half-page crops, once. An earlier pair of
runs went through OpenRouter at "minimal" reasoning by mistake (the local `.env.local` still has the old settings); its numbers were the same
(81.3% of words read right) and are kept only as a third and fourth sample of the same failures.

## Results

| | Words read right | Cost per page | Time per page |
|---|---|---|---|
| Whole page, production settings (2 runs) | **81.4%** (WER 19.3%) | **5.5 paise** | 13.5 s |
| Half-page crops (1 run) | 82.8% (WER 23.5%: the overlap repeats a line) | 8.7 paise | 21.6 s |

By page (whole page): numerical 89-94%, equations and definition 88-90%, circuit page 82-90%, Biology prose 86-88%, the edited table page 75-83%,
the multiple-choice page 54-64% (the electron-dot equation could not be read, rightly marked [?] at low confidence).

The word score hides what matters. **These are the reads that would change a mark or where an answer is filed**, and the confidence the reader gave:

| Page | What happened | Runs | Confidence |
|---|---|---|---|
| p2 | Option letters read wrong: Q2 (A) as B, Q6 (B) as A, Q8 (D) as B. The examiner's red tick crosses each of these letters. Multiple choice is marked by code from the letter, so each is a lost mark. | every run, whole page and crops | **0.95** |
| p10 | "Q.26)" and "Q.27)" read as **20 and 21**. On plain paper the matching rule trusts a written number at 0.8 or more, so two Chemistry answers would be filed under assertion-reason Q20/Q21. | both whole-page runs; **right in the crops** | **0.95** |
| p16 | A clause the student never wrote: "the number of chromosomes **of gametes is half** the number" in place of "is maintained due to inheritance". The textbook's idea, not the student's words. | 1 of 2 runs (and 1 of 2 OpenRouter runs); right in the crops | 0.75 |
| p23 | The crossed-out "pole" read instead of the student's correction "optical centre"; once a table header invented ("Real image" for "Virtual image by concave lens") and "infinity to focus"; once the convex/concave columns swapped (OpenRouter run). | every whole-page run; crops wrote [?] instead | 0.75 |

**Confidence is not a safety net.** The product re-reads only below 0.7 and sends [?]-heavy answers to a person; none of the reads above would
have been stopped. Wrong letters and wrong question numbers came back at 0.95. The reader also fills in from what the answer *should* say when it
cannot read the student (p16, p23), despite the prompt's "never guess" rule.

**Higher resolution helps, partly.** Half-page crops fixed the question numbers and the invented p16 clause, and turned guesses into honest [?];
they did not fix the ticked letters. At high detail the provider shrinks a whole page to about 768 px on its short side, which is likely why small
digits and corrections suffer.

## Limits

One student, six pages, one transcriber (the ground truth was typed by the assistant from the scans and has not been checked by a person). Flatbed
scans, not phone photos: no shadow, tilt or blur, so real uploads may read worse. The examiner's red ink is on these pages and will not be on a
learner's; it probably causes the letter errors, so the letter result may be pessimistic for learners. The 2025 paper is not here, so placement
was judged by the numbers read, not run through the full matching.

## What this means

1. **Do not price or promise reading of plain-paper booklets yet.** On plain paper, the wrong question numbers alone would file answers under the
   wrong questions.
2. **Cheap code checks that would have caught most of the above** (no new model calls):
   - *Multiple choice:* students write the option's words beside the letter (p2 does on every line). When those words match a different option
     than the letter, send it to a person. That would catch Q6 and Q8 here, assuming the words are the option's own (the 2025 paper is not here
     to confirm it).
   - *Question numbers:* run the text-only answer-key match on every answer, not only unplaced ones, and send an answer to a person when its written
     number points to a question its content does not fit (chemical equations under an assertion-reason question). The matching rule already
     names this case; 5a only runs the matcher for unplaced writing.
3. **Read at higher resolution**: crop each page (two halves with a small overlap, or each printed box of the answer sheet) at about 1.6 times the
   cost (8.7 against 5.5 paise a page; a 30-page booklet about Rs 2.6 against Rs 1.7 at standard price, half that on batch). Needs de-duplication
   at the seam.
4. **A second opinion from a different model** where two reads disagree. Luna re-reading luna repeated the same letter errors.
5. **Prompt:** say exactly what to do with a crossed-out word and an inserted correction, and repeat that unreadable writing is [?], never the
   expected answer.
6. **Measure again on what learners will send:** the printed answer sheet, filled in by hand and photographed on a phone, with the printed box
   numbers and the circled-letter grid. The box removes the number problem by design, and no examiner ink is on the letters.

**Spent:** about Rs 1.8 for 36 page reads across all runs.
