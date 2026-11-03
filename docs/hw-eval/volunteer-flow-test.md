# Volunteer flow: manual test script (roadmap task 3.3)

Run this on a **test environment** (never production data) before the first volunteer is invited, once on a **Samsung Galaxy Tab with the S Pen** and once on a **phone** (finger only). About 45 minutes. Tick each line; write what you saw where it differs.

Tester: ____________  Date: ________  Device: ____________  Browser: ____________  Build / commit: ____________

## 0. Set-up (the platform owner, before the test)

- [ ] `HW_EVAL_TOOLS_ENABLED=true` on the test environment; `HW_EVAL_COPY_DATASETS` names a dataset of known texts (for example `smallrun-a@v1`, which holds English, Hindi and mixed texts).
- [ ] Migrations 021 and 022 are applied on the test database.
- [ ] The owner is signed in as super admin. Open **Insights → Evaluation**: the cards Raters, *Invite an evaluator by email*, *Consent*, and the dataset card are all there.
- [ ] A test email address you can read (a mailbox you control) that has **no account yet**.

## 1. Invite and sign up

- [ ] *Invite an evaluator by email*: enter the test address, a pseudonym (for example `TestVol_01`), skills `transcribe`. Press **Send invitation**. The message says "Invitation sent." The list shows the invitation as **pending**.
- [ ] The email arrives. It has English **and** Hindi text, names the pseudonym, and says until when it is valid. The button opens the sign-up page **with your address already filled in**.
- [ ] Sign up with that address. You are asked to confirm your email; you cannot sign in before you do.
- [ ] Open the confirmation link. Sign in. **You land on `/evaluate`, not on a dashboard.**
- [ ] In the owner's screen the invitation is now **accepted**, and the Raters list shows `TestVol_01`.
- [ ] While signed in as the volunteer, type `/dashboard`, `/dashboard/user` and `/dashboard/teacher/assignments` in the address bar. **Each one takes you back to `/evaluate`.**
- [ ] On the Raters card the volunteer appears; a student of an institution invited the same way would be marked **blocked** with a reason (optional check: invite a school-student's email).

## 2. Language

- [ ] On `/evaluate` the **English ⇄ हिन्दी** button is at the top right. Press it: the whole page changes language. Reload the page: the choice is remembered.
- [ ] The same button and language are on the task page, the adjudication page and the copy page, and on every task form (transcription, blind marking, key audit, de-identification).
- [ ] In Hindi nothing important is left in English (buttons, hints, headings). Write down any English that remains: ____________

## 3. Consent gate (copy tasks, source A)

- [ ] **Before the owner records your consent:** open *Copy texts on the writing pad*. You are told your consent has not been recorded; no text is offered and nothing can be uploaded.
- [ ] The owner records a consent: *Who signed* = Volunteer, the pseudonym, form `volunteer-v1`, date signed, *Collected by*, **your account email**, sources **A**, uses **evaluation**. The list shows it as **active**.
- [ ] Reload `/evaluate/copy`: the first text is now offered.
- [ ] (Owner) withdraw the consent with a reason. The volunteer reloads the copy page: copy tasks are closed again. Record it again to continue.

## 4. Writing on the pad (do each on the Tab with the S Pen, and on the phone with a finger)

- [ ] The text to copy is shown, in the right script (try an English text and a Hindi text; Devanagari must look right).
- [ ] Write with the pen: lines are smooth, pressure changes the thickness, ruled lines are visible, the pad grows as you write.
- [ ] **Palm rejection (Tab):** rest your palm on the screen while writing with the pen. No stray marks. Two fingers scroll the page.
- [ ] **Undo, redo, eraser, clear:** each works. Clear asks for confirmation.
- [ ] Rotate the tablet: what you wrote does not move.
- [ ] Press **Save and next**. The next text appears; the "left to copy" count goes down by one.
- [ ] Try to copy the same text again (open it from another tab): you are told you have already copied it.
- [ ] Go offline for a moment while writing, then press Save: you get a clear error and can try again (nothing is lost on screen).

## 5. Printable copy sheets (the owner, on a computer)

- [ ] `npm run hw:eval:mutate -- sheets --dataset smallrun-a@v1 --out sheets.html` (from `apps/api`).
- [ ] Open `sheets.html` in a browser and **print to PDF, A4**. There is an answer sheet per two texts, then one instruction page at the end ("text to copy") listing every text by its code.
- [ ] **English, Hindi and mixed texts all show correctly** on the instruction page (check Devanagari conjuncts such as क्ष, ज्ञ, श्र and the matras).
- [ ] Each answer box has a QR code and a short code; the code matches the instruction page. A phone's camera reads the QR code (it holds only an opaque item id, never a name).
- [ ] Printed on paper, the ruled box is large enough to copy two lines in ordinary handwriting.

*Checked by the developer on 4 Nov 2026 (no printer, no tablet): the sheets for `smallrun-a@v1` (20 texts) render as 12 A4 pages in Edge; English, Hindi and mixed texts and the QR codes display correctly.*

## 6. After the test

- [ ] The upload from section 4 is under `hw-assignments/evals/copies/…` in the test bucket, with `ink.v1.json.gz`, `render.v1.png` and `meta.json` (pseudonym, device, duration; no name).
- [ ] The Raters card shows the volunteer's counts.
- [ ] Remove the test volunteer's rater access (Deactivate) and the test invitation and consent records are left in the audit trail (they cannot be erased: that is intended).

**Not covered here:** photographing the paper sheets and bringing the photos in as reading items (pilot step 1 does this; there is no screen for it yet), and Hindi text for the *owner's* screens (they are English).

Result: ☐ all passed   ☐ passed with notes   ☐ failed. Notes: ______________________________________________
