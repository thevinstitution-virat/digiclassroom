# InkBuddy as a compassionate teacher: roadmap (13 Nov 2026)

The owner's brief, in short: InkBuddy should mark like a dedicated, compassionate teacher, in the spirit of NEP 2020, CBSE's marking practice
and the guru–shishya tradition. It should show the learner exactly what was right and what to fix, in their own words and the book's, and
build exam-hall habits: the pen, the time and the page. Every phase below ships to **DigiClassroom and Study Buddy together**, as the
earlier InkBuddy work did, each keeping its own UI.

## What exists today (checked in the code)

| Area | Today |
|---|---|
| Writing pad | Pen, eraser, undo/redo, clear, "more lines", stylus-only. One colour, one tip. **Lags as the answer grows** (see Phase 0). |
| Answer modes | Write (ink), Type, Photo (paper). |
| Same question again | Opening a question already practised reopens the **same** attempt. "Write it again" exists only for work that was held back (an unsure reading or mark). No attempt count is shown in search. |
| Result page | "AI practice estimate. This mark was suggested by AI to help you practise. No teacher has checked it." Then the total, the reading of the answer, and each key point with its marks. |
| Marking evidence | For every key point the marker returns a verdict and a **quote from the learner's answer** that is checked against the transcript (a quote that is not there is dropped). This is the base for green underlines. |
| Model answer | Every answer key has a `referenceAnswer` written from the book's passages, with citations (book, chapter, pages). It is never shown to the learner today. |
| Time | Visible time on each question is measured silently (`timeSpentMs`); every ink point carries its own timestamp. Nothing is shown. |
| Concept feedback | "Your questions could not be matched to the textbook, so there is no concept feedback for this work." on InkBuddy results: the concept matcher does not place questions that came through the library hub (a bug, see Phase 1). |

## Phase 0: the writing pad keeps up with the pen (first, before anything else)

**Cause of the lag (InkPad.tsx):** on every animation frame while the pen moves, `paint()` clears the canvas, redraws every ruled line,
then recomputes the outline of **every stroke already written** and fills it again. The work per frame grows with the answer, so a long
answer drags. On top of that:
- the canvas is a normal 2D context, so the browser adds a frame of compositing delay;
- when the learner pauses for 8 seconds, the answer is rendered to PNG and gzipped **on the main thread**, so writing that resumes
  during the upload stutters;
- the answer screen re-renders every second (the visible-time tick), and the pad is re-rendered with it.

**Fix:**
1. Two canvases. A **base layer** holds the ruled page and all finished strokes and is redrawn only when a stroke is committed, erased or
   undone. A **live layer** on top draws only the stroke under the pen, adding just the new points each frame.
2. Cache each finished stroke's outline (`Path2D`), so committing a stroke never recomputes the others.
3. Low-latency canvas (`getContext('2d', { desynchronized: true })` where supported), and pen prediction (`getPredictedEvents`) drawn
   only on the live layer, so the ink sits under the nib.
4. PNG rendering and gzip in a **Web Worker** (or deferred until the pen has been lifted for a while and the page is idle).
5. Wrap the pad in `React.memo` with stable props, so the one-second tick never re-renders it.

**Done when:** at 300 strokes on a mid-range Android tablet and an iPad, the ink stays under the nib (frame time under 8 ms while
writing, measured with a test page), and an upload during writing causes no visible stutter.

**Size:** one session. **Risk:** low; the stroke format and the uploaded files do not change.

## Phase 1: quick wins (one to two sessions)

**Built 13 Nov 2026** (DigiClassroom and Study Buddy):
- Attempts are in `practice/attempts.ts`. "Attempted (n)" in search; a question already practised opens its latest attempt. "Write it again" after a mark makes a new one-question attempt that copies the question, its marking points and its answer key, so no new key is built. The limit is `HW_SELF_PRACTICE_MAX_ATTEMPTS_PER_QUESTION` (10) per question in the current plan, counted from the trial's start (a paid plan's start will restart it). The trial's limit on questions now counts different questions, not attempts.
- The result page shows "Evaluated by Virat Evaluator · practice marks" with "How is this marked?", the attempt history, the **Your answer / As we read it** toggle (the ink page, photo or typed text), and the book's answer on a notebook page (Kalam, self-hosted in `public/fonts/kalam`, SIL OFL) with the textbook pages.
- Concept feedback places a practice question through its answer key's own book and passages (`graphFromKey`), before falling back to search. The book's id is now recorded on the question (`origin_ref.workId`).
- Tests: `practice-attempts` (6). Walked through in a browser.

1. **"Attempted (n)" and up to 10 attempts per question.**
   - In search results, a question already practised shows **Attempted (3)**.
   - Every marked attempt offers **Write it again**, until the 10th. The 10th says it was the last for this question.
   - Each attempt is its own submission, so the result page can show the attempts side by side (marks over time).
   - The answer key is built once and reused, so a new attempt costs only reading and marking (a fraction of a rupee). The trial
     allowance still bounds the total.
   - Setting: `HW_SELF_PRACTICE_MAX_ATTEMPTS_PER_QUESTION` (default 10), next to the existing total-attempts limit.
2. **"Evaluated by Virat Evaluator"** in place of "AI practice estimate… No teacher has checked it".
   - Proposed wording: **"Evaluated by Virat Evaluator · practice marks"**, with a small "How is this marked?" link explaining the
     book-based key and the value points.
   - The honesty stays in that link, not in a warning.
   - School homework keeps teacher review as today.
3. **"Your answer / As we read it" toggle** on the result, for each answer:
   - **Your answer:** the latest version the learner handed in, as they wrote it (the ink page), photographed it (the photo) or typed it
     (their text). The files already exist and are served through short-lived links.
   - **As we read it:** the transcript.
4. **The book's answer on a notebook page.**
   - The key's `referenceAnswer` on a ruled page with a margin, in a handwriting-style font. Kalam (Google Fonts) covers both English and
     Devanagari, so Hindi-medium answers look right too.
   - Under it: "From your textbook: chapter 5, pages 72–73".
   - Shown only after marking, never before.
5. **Fix concept feedback for InkBuddy.** Place hub questions by the key's citations (work, chapter), so "What to work on" names real
   concepts instead of "could not be matched".

## Phase 2: the teacher's pen (two to three sessions, behind a setting)

**Built 13 Nov 2026** (DigiClassroom and Study Buddy), off until `HW_TEACHER_PEN_ENABLED=true`:
- **A separate call, not the marking call.** The remark and the notes come from one extra call per answer (`practice/teacher-pen.ts`, prompt `teacher-pen.v1` with the teacher's charter). It is made by the job runner's new "teacher pen" step after the practice release. It cannot move a mark, and it needs no regression run of the marking prompts. The cost is one small call per answer on the marking model, recorded as a finished job (kind `grade`, payload `{pen: true}`), so it shows in the AI usage view and is charged to the learner's trial. Each answer is tried at most twice.
- **Green** comes from the marking's own quotes (met: solid; partly met: dotted). There is no new call for it.
- **Checks in code** (`checkPen`):
  - every quote must be in the reading;
  - language notes only on a confident reading;
  - at most three wrong-fact, three language and two presentation notes;
  - no notes on unread words.
- **Storage:** `hw_answer.ink_stats.pen`. No migration.
- **Screen:** the reading with underlines (wavy red, yellow, dotted grey, green), a key to the colours, numbered notes with the better wording, and the remark on a paper slip in Kalam, signed "— Virat Evaluator".
- **Tests:** `teacher-pen` (7), `practice-teacher-pen` (4, database). Walked through in a browser with a sample pen.

**Coloured underlines on the transcript:**

| Colour | Meaning | Where it comes from |
|---|---|---|
| Green | A correct point (a value point met) | The marker's quotes, which are already evidence-checked. Nothing new to trust. |
| Red | A wrong fact | New: the marker names a contradiction, with the exact words and the book's correct statement. |
| Yellow | Language: spelling, grammar, punctuation | New, gentle, at most a few per answer. |
| Dotted grey | Presentation: no units, no labelled diagram, a long answer with no structure | New. |

Each underline opens a small note in plain words ("Write 'amylase', not 'amylace'"; "The book says the stomach makes pepsin, not saliva").

Rules, so the pen is never unfair:
- **Every underline quotes words that are really in the transcript.** The existing evidence check drops any mark that cannot be found,
  exactly as for key-point quotes today.
- **Language notes only on a confident reading.** The reader can make a spelling mistake of its own, so spelling is flagged only when the
  reading was high-confidence, and phrased as "check the spelling of…". Never on a photo the reader was unsure of.
- **Underlines never change the mark.** Marks come only from the value points, as CBSE marks.
- **Few, not many:** at most three language notes per answer, chosen for what matters most. A teacher does not mark every comma.

**The remark: a teacher's note at the end** (two to four sentences, in the learner's medium):
1. What went well, specifically ("You explained clearly that salivary amylase breaks starch into sugar").
2. The one or two things that would add marks, and how ("Add that saliva moistens food so it is easy to swallow").
3. An encouraging close that looks forward ("One more point and this is a full-mark answer. Try it again.").

How the remark is held to the brief:
- **The voice** is written into a new marking prompt as a teacher's charter, drawn from:
  - **NEP 2020:** formative and competency-based feedback, the holistic progress card's "what the learner can do next";
  - **CBSE:** value points, step marking, presentation;
  - **the guru–shishya ideal:** patience, praise that is earned and specific, one clear next step, never shaming, the learner's growth
    over the mark.
- **No empty praise:** every compliment must point to something in the answer.
- **Tested before switching on:** the charter is checked on the regression set before it goes live (the gate the marking prompts
  already pass), so the marks themselves cannot move.
- **Cost:** the underlines and the remark come from the same marking call, one larger output.
- **Settings:** `HW_TEACHER_PEN_ENABLED`, off until the regression run passes, then on for InkBuddy first.

## Phase 3: the exam-hall writing kit (two sessions)

Only what a CBSE candidate may use in the hall:

| Tool | Detail |
|---|---|
| Ball pen, **blue** or **black** | Tips 0.5 and 0.7 mm. Pressure-sensitive width from the stylus. |
| **Pencil** (graphite grey) | For diagrams and graphs, as the hall allows. |
| **Strike-through** | A single neat line through a mistake, the way the hall allows a correction. The stroke stays under the line. |
| Eraser | Pencil only; a pen cannot be erased in the hall. Kept for pen as an option the learner can switch off, for those who want strict practice. |
| **Ruler** | Straight lines for diagrams and tables. |
| Page | Ruled answer-book page with a red margin, a **full-screen writing mode** (like the expand button in the note app screenshot), and page breaks like a real answer book. |

**Not offered:** colours other than blue, black and pencil (red and green are the examiner's), highlighters, lasso and move, text
boxes, shapes.

The ink colour is stored with each stroke; the reader is unaffected (it reads dark ink on white either way).

## Phase 4: time, writing speed and handwriting (two sessions)

1. **Stopwatch** above the answer area: Start, Pause, Stop, with the hint "Start when you begin writing, pause if you leave, stop when
   you finish."
   - The pad also measures **active writing time** by itself, from the timestamp on every ink point. Gaps longer than about 20 seconds
     count as a pause. So a learner who forgets the stopwatch still gets a speed.
   - Both are shown; the stopwatch is the learner's own.
2. **Writing speed** = words in the reading ÷ active minutes, shown as "about 14 words a minute".
   - The grade card shows the trend over attempts ("up from 11 last week"), not a judgement.
   - A gentle guide for exam pacing: "a 5-mark answer at this speed takes about 8 minutes".
3. **A note on handwriting** on the grade card, kind and practical: "Clear and well spaced. Keep letters the same size on each line", or
   "Some words run together; leave a small gap after each word".
   - **Ink answers:** from the strokes themselves (letter size, line keeping, spacing), measured in code at no AI cost.
   - **Photo answers:** from one extra line in the reading call (legibility and spacing).
   - **Never scored, never a mark.**
4. Typed answers show typing speed instead, with a note that the exam is handwritten.

## Phase 5: the grade card and the UI upgrade (two sessions)

- **One result page per attempt,** built like a teacher's corrected copy:
  - the learner's page with the coloured underlines;
  - the teacher's remark in a handwriting-style font beside it;
  - the marks per value point;
  - the book's answer on the notebook page;
  - time and speed;
  - "Write it again".
- **The InkBuddy home:** questions practised, attempts, marks over time, and "questions to revisit" (marked below full).
- **Bilingual throughout,** large touch targets, works at phone width, readable in sunlight.

## Order and why

| Order | Phase | Why this order |
|---|---|---|
| 1 | Phase 0, the lag | A pad that lags makes every later feature feel broken. |
| 2 | Phase 1 | Cheap, visible, no new AI; the attempts change shapes everything after it. |
| 3 | Phase 2 | The heart of the brief, and the one that needs care: the regression gate before it is switched on. |
| 4 | Phases 3 and 4 | Independent of each other; either can go first. |
| 5 | Phase 5 | Pulls it together once the pieces exist. |

About 10 to 13 sessions in all. Each phase ends with:
- tests;
- a walk-through in a browser on a phone and a tablet;
- the same change in Study Buddy (with its icon check);
- the deploy.

## Owner's decisions (13 Nov 2026)

1. **Label:** "Evaluated by Virat Evaluator · practice marks", with a "How is this marked?" link. Agreed.
2. **Eraser:** none for the pen (strike-through only, as in the hall). The **pencil has an eraser**, because the pencil is for diagrams.
3. **Attempts:** 10 per question **during the free trial**. When the learner becomes a paid user the count starts again from zero.
   **Every attempt is kept** as the question's revision history (shown on the result page as attempts over time).
4. **Writing speed:** show the pacing guide, and a **percentile** of writing speed against other learners.
5. **Marks percentile:** the learner's marks against others who attempted the **same question**, or the **same set of questions in one
   session**.

Percentiles (4 and 5), how they will be built:
- From anonymous aggregates only: no other learner's name, answer or mark is ever shown.
- Shown only when at least 20 other learners attempted the same question or set (fewer makes the number meaningless and could identify
  someone). Below that: "Not enough learners yet to compare".
- First attempts only count towards the comparison, so a learner's tenth try does not inflate the field.
- Worded encouragingly ("You wrote faster than 62% of learners on this question"), never as a rank.

These go into Phases 1 (attempt counts and history) and 4 (speed, pacing, percentiles); percentiles of marks join the grade card in
Phase 5.
