// Exam packages, phase 4: the photo booklet. Once writing time is over, the learner photographs every answer page and uploads them here, puts
// them in order, and hands the booklet in. The page is checked twice: in the browser (blur, light, glare — page-measure.ts, before it costs an
// upload) and here (what the bytes really are, their size in pixels and in bytes, a duplicate, the page limit, and whether the upload window is
// open — the browser is never trusted for any of those). Pages live under hw-exams/ in private storage and are shown through short-lived links.
//
// When the upload window closes, an attempt with pages is handed in as it stands (rules.settle); one with no page is abandoned.

import { createHash, randomUUID } from 'node:crypto';
import { getHwConfig } from '../config';
import { and, asc, count, eq, max, sql } from 'drizzle-orm';
import { hwExamAttempt, hwExamPage } from '@/db/hw-exams-schema';
import { HwError } from '@/lib/hw/errors';
import type { Exec } from '@/lib/hw/db';
import { readImageHeader } from '@/lib/hw/bank/figures';
import { examPageKey } from '@/lib/hw/storage/keys';
import type { PageStore } from '@/lib/hw/storage/exam-pages';
import { ownAttempt, requireEnabled, settleOpen } from './learner';
import { PAGE_LIMITS, SOFT_PAGE_PROBLEMS, pageVerdict, uploadVerdict, type PageProblem } from './rules';

const both = (en: string, hi: string) => `${en} / ${hi}`;

const NO_UPLOAD = {
  too_early: both('Pages are uploaded after the writing time ends. Press “I have finished writing” first.', 'पन्ने लिखने का समय समाप्त होने के बाद अपलोड होते हैं। पहले “मैंने लिखना पूरा कर लिया” दबाएँ।'),
  too_late: both('The upload time for this attempt has ended.', 'इस प्रयास के अपलोड का समय समाप्त हो गया है।'),
  wrong_status: both('This attempt is no longer taking pages.', 'यह प्रयास अब पन्ने नहीं ले रहा है।'),
} as const;

const PAGE_PROBLEM_TEXT: Record<PageProblem, string> = {
  too_small: both('This photo is too small to read. Take it again, closer and with the whole page filling the frame.', 'यह फ़ोटो पढ़ने के लिए बहुत छोटी है। पूरा पन्ना फ़्रेम में भरकर, पास से फिर लें।'),
  too_large: both('This photo file is too large.', 'यह फ़ोटो फ़ाइल बहुत बड़ी है।'),
  too_blurred: both('This photo is blurred. Hold the phone still and take it again.', 'यह फ़ोटो धुंधली है। फ़ोन स्थिर रखकर फिर लें।'),
  too_dark: both('This photo is too dark. Take it again in better light.', 'यह फ़ोटो बहुत अँधेरी है। बेहतर रोशनी में फिर लें।'),
  too_bright: both('This photo is too bright. Move away from direct light.', 'यह फ़ोटो बहुत चमकीली है। सीधी रोशनी से हटकर लें।'),
  glare: both('There is glare on this photo. Tilt the page or switch off the flash.', 'इस फ़ोटो पर चमक है। पन्ना थोड़ा झुकाएँ या फ़्लैश बंद करें।'),
};

/** What the browser measured; trusted only for the learner's own benefit (a bad photo costs them a mark, not the platform). */
export interface BrowserFacts { sharpness: number; brightness: number; glare: number; override: boolean }

/** Pages can be added, removed and reordered only while the attempt is time_up and inside its upload window. */
async function openBooklet(d: Exec, userId: string, attemptId: string, now: Date) {
  requireEnabled();
  await settleOpen(d, userId, now, attemptId);
  const a = await ownAttempt(d, userId, attemptId);
  const v = uploadVerdict(now, a);
  if (!v.ok) throw new HwError('CONFLICT', NO_UPLOAD[v.why], `booklet closed: ${v.why}`);
  if (a.status !== 'time_up') throw new HwError('CONFLICT', a.status === 'started' ? NO_UPLOAD.too_early : NO_UPLOAD.wrong_status);
  return a;
}

export async function addPage(d: Exec, store: PageStore, userId: string, attemptId: string, bytes: Uint8Array, facts: BrowserFacts, now = new Date()) {
  await openBooklet(d, userId, attemptId, now);
  const head = readImageHeader(bytes);
  if ('problem' in head) throw new HwError('BAD_REQUEST', both('This file is not a photo we can use.', 'यह फ़ाइल ऐसी फ़ोटो नहीं है जिसका उपयोग हो सके।'), head.problem);
  // the server's own checks; the browser's measurements are re-checked only to record them
  const verdict = pageVerdict({ widthPx: head.width, heightPx: head.height, bytes: bytes.length, sharpness: facts.sharpness, brightness: facts.brightness, glare: facts.glare });
  if (!verdict.ok && !(SOFT_PAGE_PROBLEMS.has(verdict.why) && facts.override)) throw new HwError('BAD_REQUEST', PAGE_PROBLEM_TEXT[verdict.why], `page refused: ${verdict.why}`);
  const pages = (await d.select({ n: count() }).from(hwExamPage).where(eq(hwExamPage.attemptId, attemptId)))[0]!.n;
  if (pages >= PAGE_LIMITS.maxPages) throw new HwError('CONFLICT', both(`A booklet holds at most ${PAGE_LIMITS.maxPages} pages.`, `एक पुस्तिका में अधिकतम ${PAGE_LIMITS.maxPages} पन्ने हो सकते हैं।`));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const dup = (await d.select({ id: hwExamPage.id }).from(hwExamPage).where(and(eq(hwExamPage.attemptId, attemptId), eq(hwExamPage.sha256, sha256))).limit(1))[0];
  if (dup) throw new HwError('CONFLICT', both('This photo is already in your booklet.', 'यह फ़ोटो पहले से आपकी पुस्तिका में है।'));

  const id = randomUUID();
  const key = examPageKey(attemptId, id, head.ext);
  await store.put(key, bytes, head.mime); // stored first: a row never points at a missing object
  try {
    const position = ((await d.select({ m: max(hwExamPage.position) }).from(hwExamPage).where(eq(hwExamPage.attemptId, attemptId)))[0]?.m ?? -1) + 1;
    await d.insert(hwExamPage).values({
      id, attemptId, position, imageKey: key, mimeType: head.mime, widthPx: head.width, heightPx: head.height, bytes: bytes.length, sha256,
      quality: { sharpness: facts.sharpness, brightness: facts.brightness, glare: facts.glare, override: facts.override, verdict: verdict.ok ? 'ok' : verdict.why },
    });
    return { pageId: id, position, warning: verdict.ok ? null : verdict.why };
  } catch (e) {
    await store.remove(key).catch(() => undefined);
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === '23505') throw new HwError('CONFLICT', both('That page was just added. Please try again.', 'वह पन्ना अभी जोड़ा गया। कृपया फिर कोशिश करें।'));
    throw e;
  }
}

export async function removePage(d: Exec, store: PageStore, userId: string, attemptId: string, pageId: string, now = new Date()): Promise<void> {
  await openBooklet(d, userId, attemptId, now);
  const r = await d.delete(hwExamPage).where(and(eq(hwExamPage.id, pageId), eq(hwExamPage.attemptId, attemptId))).returning({ key: hwExamPage.imageKey });
  if (!r.length) throw new HwError('NOT_FOUND', both('That page is not in this booklet.', 'वह पन्ना इस पुस्तिका में नहीं है।'));
  await store.remove(r[0]!.key).catch((e) => console.warn(`[hw-exams] page object not removed: ${r[0]!.key}`, e));
}

/** Puts the pages in the given order. Every page of the booklet must be named exactly once. */
export async function reorderPages(d: Exec, userId: string, attemptId: string, orderedIds: string[], now = new Date()): Promise<void> {
  await d.transaction(async (tx) => {
    await openBooklet(tx, userId, attemptId, now);
    await tx.select({ id: hwExamAttempt.id }).from(hwExamAttempt).where(eq(hwExamAttempt.id, attemptId)).for('update');
    const have = await tx.select({ id: hwExamPage.id }).from(hwExamPage).where(eq(hwExamPage.attemptId, attemptId));
    const ids = new Set(have.map((h) => h.id));
    if (orderedIds.length !== ids.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((i) => !ids.has(i))) {
      throw new HwError('BAD_REQUEST', both('Name every page exactly once.', 'हर पन्ना ठीक एक बार चुनें।'));
    }
    await tx.update(hwExamPage).set({ position: sql`${hwExamPage.position} + 100000` }).where(eq(hwExamPage.attemptId, attemptId));
    for (const [i, id] of orderedIds.entries()) await tx.update(hwExamPage).set({ position: i }).where(eq(hwExamPage.id, id));
  });
}

/** "These are all my pages": the booklet is handed in and can no longer change. */
export async function submitBooklet(d: Exec, userId: string, attemptId: string, now = new Date()): Promise<{ pages: number }> {
  await openBooklet(d, userId, attemptId, now);
  const pages = (await d.select({ n: count() }).from(hwExamPage).where(and(eq(hwExamPage.attemptId, attemptId), eq(hwExamPage.status, 'accepted'))))[0]!.n;
  if (!pages) throw new HwError('CONFLICT', both('Add at least one page first.', 'पहले कम से कम एक पन्ना जोड़ें।'));
  // on the batch path the report gets its promised time at hand-in, so the learner sees it at once (exams/batch.ts)
  const cfg = getHwConfig();
  const readyBy = cfg.HW_EXAMS_BATCH_ENABLED
    ? sql`CASE WHEN ${hwExamAttempt.evaluationMode} = 'batch' THEN ${new Date(now.getTime() + cfg.HW_EXAMS_BATCH_HOURS * 3_600_000).toISOString()}::timestamptz ELSE NULL END`
    : null;
  const r = await d.update(hwExamAttempt).set({ status: 'uploaded', submittedAt: now, ...(readyBy ? { readyBy } : {}) })
    .where(and(eq(hwExamAttempt.id, attemptId), eq(hwExamAttempt.userId, userId), eq(hwExamAttempt.status, 'time_up'))).returning({ id: hwExamAttempt.id });
  if (!r.length) throw new HwError('CONFLICT', NO_UPLOAD.wrong_status);
  return { pages };
}

export interface BookletPage { id: string; position: number; url: string; width: number; height: number; warning: string | null }

/** The learner's own pages, in order, with short-lived links to show them. */
export async function bookletPages(d: Exec, store: PageStore, attemptId: string): Promise<BookletPage[]> {
  const rows = await d.select().from(hwExamPage).where(and(eq(hwExamPage.attemptId, attemptId), eq(hwExamPage.status, 'accepted'))).orderBy(asc(hwExamPage.position));
  return Promise.all(rows.map(async (p) => {
    const v = (p.quality as { verdict?: string }).verdict;
    return { id: p.id, position: p.position, url: await store.readUrl(p.imageKey), width: p.widthPx, height: p.heightPx, warning: v && v !== 'ok' ? v : null };
  }));
}
