# Photo answers (Phase 5P, built 13 Nov 2026)

The owner decided D4 on 13 Nov 2026: build photo answers. A learner writes the answer on paper, takes a photo, and that photo is what is
read and marked: the same reader, the same marking, the same teacher screens as an answer written on screen.

## Where it is offered

- **InkBuddy:** always. Every practice question offers Write, Type and **Photo**, including questions started before this change
  (`answerModesOf` in `practice/rules.ts`; nothing in the database changed).
- **School homework:** when the teacher ticks **Photo** under answer modes on a new assignment (off by default).
- **Exam packages:** unchanged. They have their own photo booklet (`exams/pages.ts`), which now shares its checks with photo answers.

## How a photo travels

1. **On the device** (`components/hw/photo/prepare.ts`): the picture is turned the right way up, measured for light, glare and focus on a
   small copy (`lib/hw/photo/measure.ts`), shrunk to 1600 px on the long side, made greyscale and saved as JPEG. Re-drawing it drops the EXIF
   data, the phone's location included. A doubtful photo (blurred, dark, bright, glare) is shown back with what to fix; the learner may still
   use it. A photo below about 1 megapixel is refused outright.
2. **Upload** (`POST /api/hw/submissions/:id/photo`, `storePhoto` in `services/submissions.ts`): at once, never kept on the device, so it
   needs the network. The server reads what the bytes really are (`lib/hw/photo/image.ts`), applies the same limits (`lib/hw/photo/rules.ts`)
   and stores the photo under `hw-assignments/…/photo.v{n}.jpg`, a new version on every re-take. The InkBuddy screens send `x-hw-space:
   practice` with the upload, as they do for ink now (that header was missing from ink uploads, so a school student's InkBuddy writing could
   be refused; fixed in the same change).
3. **Reading** (`jobs/read-handler.ts`): the picture read is chosen by the mode the learner handed in with (`answerImageKey`): the photo for a
   photo answer, the ink render otherwise, so switching between Write and Photo never reads the wrong one. The reader is told the picture type.
4. **Teacher view:** the marking screen's original shows the photo.

A question left on Photo with no photo cannot be handed in ("Question N has no photo yet").

## Not built

- **Cropping on the device.** The learner frames the photo; the reader sees the whole picture.
- **More than one photo per answer.** One photo per question; a long answer must fit one page.
- **Thresholds are provisional.** The light, glare and focus limits are the exam booklet's, not yet calibrated on real photos; the "too bright"
  limit was raised from 0.92 to 0.97 on 13 Nov 2026, after a light page with little writing was called too bright. Because these problems can be overridden, a wrong threshold costs a
  learner one extra tap, not their answer. Calibrate on the first real photos.
- **Cost.** A photo is a larger picture than an ink render (1600 px against at most 1000 px), so reading it costs somewhat more. Watch the AI
  usage view after launch.

## Local testing

`HW_DEV_LOCAL_STORAGE_DIR` (ignored in production) now keeps answer files in a local folder too, so photos can be tried without the shared
bucket. Tests: `photo-answers` (7), and two in `integration` ("photo answer").
