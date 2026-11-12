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
   **Both built (12 Nov, `assemble.ts`, `evaluate.ts`).** Replaying the four real page-2 reads through the product's code (each option's words
   taken from what the student wrote, since the 2025 paper is not here): 11 of the 12 wrong letters now go to a person (the twelfth, Q2, is an
   equation with no option words, read at 0.75), and none of the 20 right letters is flagged. The replay also found that in half the runs the
   reader put the letter in its "alternative" field and left it out of the text, which sent every multiple choice to a person; that letter is
   now used. The number check is covered by tests (a "Q20" answer the matcher reads as Q26 goes to a person); a live check needs the 2025 paper.
   It costs one more text-only matcher call per booklet whenever an answer was placed by a written number.
3. **Half-page reading: built (12 Nov), on by default** (`HW_EXAMS_READ_SPLIT=halves`; `page` reads whole pages as before). Each page is cut
   into a top and a bottom half that share 8% of the height (`exams/crop.ts`, `sharp`, loaded on demand: if it is missing, pages are read whole and
   the log says so; whether the api's production image has a working sharp is not checked yet, so look for that log line after the first
   deploy); each half is read; `exams/halves.ts` joins them, dropping the writing both halves read (the longest pair of word runs that
   start and end alike and share most words, which may differ in length because each half reads the seam its own way) and keeping both reads'
   question numbers. The page's stored read says `split: 'halves'`. Pages under 1,200 px tall are read whole.
   Live on the same six pages through the product's own path (sharp cut, two reads, join), compared with the whole-page runs on production settings:

   | | Whole page (2 runs) | Halves (2 runs: crops by hand, then the built path) |
   |---|---|---|
   | Words read right | 81.4% | 82.8%, 80.9% |
   | Question numbers read right (Q22, 26, 27, 28, 30) | 5 of 10 | 7 of 10 (26 and 30 every time; 22 never) |
   | Invented clause on p16 | 1 of 2 runs | 0 of 2 |
   | Crossed-out "pole" read instead of the correction | 2 of 2 | 0 of 2 (written [?], for a person) |
   | Option letters | 3 wrong each run | 4 and 3 wrong (the letter check above catches those with words) |
   | Cost, time per page | 5.5 paise, 13.5 s | 8.7 paise, 19-22 s |

   So halves do not raise the word score and do not fix the ticked letters; what they buy is fewer **confident inventions** (the textbook's
   sentence, a crossed-out word), which no later check can catch, and somewhat better question numbers, which the matcher check now backs up.
   A 30-page booklet costs about Rs 2.6 to read at standard price (Rs 1.3 on batch) against Rs 1.7. Two runs each, one student: indicative only.
4. **Finer crops** (not built): each printed box of the answer sheet read on its own, once the printed sheet is measured.
5. **A second opinion from a different model** where two reads disagree. Luna re-reading luna repeated the same letter errors.
6. **Prompt:** say exactly what to do with a crossed-out word and an inserted correction, and repeat that unreadable writing is [?], never the
   expected answer.
7. **Measure again on what learners will send:** the printed answer sheet, filled in by hand and photographed on a phone, with the printed box
   numbers and the circled-letter grid. The box removes the number problem by design, and no examiner ink is on the letters.

**Spent:** about Rs 1.8 for 36 page reads in the first measurement, and Rs 0.5 for the 12 half-page reads of the built path.
