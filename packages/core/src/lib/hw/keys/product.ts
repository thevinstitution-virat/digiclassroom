// Answer keys in the product (roadmap 5.2; owner decisions D2 and D3).
//
//   - Saving a question queues a key build (hw_question_key, status 'building'); the job runner builds it with the key service (lib/hw/keys).
//   - A fully supported key becomes the question's rubric (value points, with citations shown to the teacher). Anything else leaves the
//     question to be marked by hand, with the reason stated.
//   - At marking time the key is checked again, without calling a model: still the current key-service version, the current settings
//     (R_min, models, index), the same question, and the same book text. If not, there is no suggestion and a rebuild is queued.
//   - Every build is paid for from the institution's monthly budget (the quota is checked before each provider call); a library hit is free.
//
// AI marking depends on where the key came from, not on who wrote the question: a teacher's own question goes through the same service.

import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { institutionClasses } from '@/db/schema';
import { hwAssignment, hwQuestion, hwRubricItem, type HwQuestionSchemeSource, type HwRubricKind } from '@/db/hw-schema';
import { db, monthKey, newId, num, type Exec } from '../db';
import { getHwConfig } from '../config';
import { EXAM_ORG_ID } from '../exams/space';
import { PRACTICE_ORG_ID } from '../practice/rules';
import { HwError, describeError } from '../errors';
import { quotaAllows, quotaRefusal, quotaState } from '../cost/quota';
import { costOf } from '../cost/usage';
import type { KeyOffReason, SchemeStamp } from '../eligibility/decision';
import { replaceRubric } from '../services/rubric-store';
import { canonicalJson } from './cache';
import { buildKey, currentKeyServiceVersion, keyConfigHash, keySettingsFromEnv, type KeyDeps, type KeySettings } from './service';
import { defaultKeyDeps } from './index';
import { passageTexts } from '../../library/db';
import { pgSharedKeyStore } from './shared-pg';
import { lookupOfficialScheme, officialSourceValid } from '../bank/official-store';
import type { AnswerKey, KeyRequest, KeyResult, ValuePoint } from './types';

export type KeyStatus = 'building' | 'ready' | 'partial' | 'no_grounding' | 'failed' | 'not_available';
export type KeySchemeSource = 'board_scheme_key' | 'passage_key' | 'textbook_key';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// ── The key service as the product runs it ───────────────────────────────────

export interface KeyRuntime { deps: KeyDeps; settings: KeySettings }
let override: (() => KeyRuntime) | null = null;
/** Tests: replace the key service's providers with fakes (null restores the real ones). */
export function _setKeyRuntime(f: (() => KeyRuntime) | null): void { override = f; }

/** Throws NOT_CONFIGURED when the key service is not set up (no writer or verifier model, or one model family). */
export function keyRuntime(): KeyRuntime {
  if (override) return override();
  const settings = keySettingsFromEnv();
  // A board-paper question's official scheme is read from the person-checked bank (migrations 032, 033): only a row a person has checked is ever offered.
  const deps = defaultKeyDeps({ official: (ref) => lookupOfficialScheme(db, ref) });
  if (settings.sharedKeys) deps.shared = pgSharedKeyStore();
  return { deps, settings };
}

/** The configuration hash a key built now would carry (writer, verifier, R_min, thresholds, prompts, retrieval, index). */
export function currentConfigHash(rt: KeyRuntime): string {
  return keyConfigHash(rt.settings, rt.deps.hub ? rt.deps.hub.indexId : rt.deps.retriever.indexId);
}

// ── What a key is built for ──────────────────────────────────────────────────

type QuestionRow = typeof hwQuestion.$inferSelect;

/** Of everything that defines the key request: a changed question makes the stored key stale. */
export function questionHash(q: Pick<QuestionRow, 'prompt' | 'type' | 'marks' | 'passage' | 'languageHint' | 'origin' | 'originRef'>): string {
  return sha(canonicalJson({ p: q.prompt.trim(), t: q.type, m: num(q.marks), ps: (q.passage ?? '').trim(), l: q.languageHint, o: q.origin, r: q.originRef }));
}

export const schemeOfSource = (s: 'official' | 'passage' | 'textbook'): KeySchemeSource =>
  s === 'official' ? 'board_scheme_key' : s === 'passage' ? 'passage_key' : 'textbook_key';

const KIND: Record<ValuePoint['kind'], HwRubricKind> = { key_point: 'key_point', step: 'key_point', unit: 'key_point', format: 'structure', competency: 'content' };

/** The value points as rubric rows (the same representation marking uses for a teacher's rubric). */
export const rubricRowsOf = (key: AnswerKey) => key.valuePoints.map((p) => ({ kind: KIND[p.kind], description: p.text, marks: p.marks }));

async function requestFor(x: Exec, q: QuestionRow): Promise<KeyRequest> {
  const [row] = await x.select({ subject: hwAssignment.subject, className: institutionClasses.name, level: institutionClasses.level })
    .from(hwAssignment).innerJoin(institutionClasses, eq(institutionClasses.id, hwAssignment.classId)).where(eq(hwAssignment.id, q.assignmentId)).limit(1);
  if (!row) throw new HwError('NOT_FOUND', 'Assignment not found.');
  const ref = q.originRef ?? {};
  return {
    questionText: q.prompt,
    questionType: q.type,
    marks: num(q.marks),
    classLevel: row.level ? String(row.level) : row.className,
    subject: row.subject,
    medium: q.languageHint === 'hi' ? 'Hindi' : 'English',
    questionOrigin: q.origin,
    ...(q.passage?.trim() ? { passageText: q.passage } : {}),
    ...(ref.book || ref.chapter ? { bookHint: { title: ref.book, chapter: ref.chapter } } : {}),
    ...(q.origin === 'board_paper' && ref.kind && ref.session && ref.subjectCode && ref.questionNo
      ? { officialRef: {
        kind: ref.kind as 'sqp' | 'past_paper', session: ref.session, subjectCode: ref.subjectCode, questionNo: ref.questionNo,
        ...(ref.board ? { board: ref.board } : {}), ...(Number.isInteger(Number(ref.classLevel)) && Number(ref.classLevel) > 0 ? { classLevel: Number(ref.classLevel) } : {}),
      } } : {}),
  };
}

// ── Queueing ─────────────────────────────────────────────────────────────────

/**
 * Queue a key build for a question in 'key' mode: the previous current key (if any) is superseded, never edited. A question in teacher mode, or one
 * that already has a key being built, queues nothing. Returns the new key row's id, or null.
 */
export async function queueKey(x: Exec, q: Pick<QuestionRow, 'id' | 'organizationId' | 'rubricMode' | 'prompt' | 'type' | 'marks' | 'passage' | 'languageHint' | 'origin' | 'originRef'>, by: string | null): Promise<string | null> {
  if (q.rubricMode !== 'key') return null;
  const hash = questionHash(q);
  const cur = await x.execute<{ id: string; status: string; question_hash: string }>(sql`SELECT id, status, question_hash FROM hw_question_key WHERE question_id = ${q.id} AND superseded_at IS NULL FOR UPDATE`);
  const c = cur.rows[0];
  if (c && c.status === 'building' && c.question_hash === hash) return null; // already on its way
  if (c) await x.execute(sql`UPDATE hw_question_key SET superseded_at = now() WHERE id = ${c.id}`);
  const id = newId();
  await x.execute(sql`INSERT INTO hw_question_key (id, organization_id, question_id, status, question_hash, created_by) VALUES (${id}, ${q.organizationId}, ${q.id}, 'building', ${hash}, ${by})`);
  return id;
}

// ── Building ─────────────────────────────────────────────────────────────────

type Claimed = { id: string; organization_id: string; question_id: string; question_hash: string; attempts: number }

async function claim(workerId: string, limit: number): Promise<Claimed[]> {
  const stale = getHwConfig().HW_JOB_STALE_MINUTES;
  const r = await db.execute<Claimed>(sql`
    UPDATE hw_question_key k SET locked_at = now(), attempts = attempts + 1
     WHERE k.id IN (SELECT id FROM hw_question_key WHERE status = 'building' AND superseded_at IS NULL
                      AND (locked_at IS NULL OR locked_at < now() - (${stale} * interval '1 minute'))
                    ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING k.id, k.organization_id, k.question_id, k.question_hash, k.attempts`);
  void workerId;
  return r.rows;
}

/** Checks the quota before every provider call a build makes. A shared-library hit makes none, so it is never refused and costs nothing. */
function guarded(deps: KeyDeps, orgId: string): KeyDeps {
  const guard = async () => {
    const st = await quotaState(db, orgId, 'grade');
    if (!quotaAllows(st, 1)) throw new HwError('QUOTA_EXCEEDED', quotaRefusal(st));
  };
  return {
    ...deps,
    generate: async (p, c) => { await guard(); return deps.generate(p, c); },
    retriever: { ...deps.retriever, indexId: deps.retriever.indexId, embed: async (t) => { await guard(); return deps.retriever.embed(t); }, search: (v, f, l) => deps.retriever.search(v, f, l) },
  };
}

interface Outcome {
  status: KeyStatus; reason?: string; detail?: string;
  result?: Extract<KeyResult, { status: 'grounded' }>; cost: number; calls: number; configHash?: string; rMin?: number; fromShared: boolean;
}

/** Runs the key service for one question; never throws (the outcome says what happened). */
export async function buildFor(q: QuestionRow, rt: KeyRuntime | null, deps2?: { req?: KeyRequest }): Promise<Outcome> {
  if (!rt) return { status: 'not_available', reason: 'not_configured', detail: 'The key service is not set up.', cost: 0, calls: 0, fromShared: false };
  let req: KeyRequest;
  try { req = deps2?.req ?? await requestFor(db, q); } catch (e) { return { status: 'failed', reason: 'request', detail: describeError(e), cost: 0, calls: 0, fromShared: false }; }
  try {
    const res = await buildKey(req, guarded(rt.deps, q.organizationId), rt.settings);
    const cost = res.calls.reduce((s, c) => s + costOf({ model: c.model, usage: c.usage, batch: false, costUsd: c.costUsd }).paise, 0);
    // A key served from the shared library costs nothing: no build is counted and no spend is recorded (the lookup's own embedding is the platform's).
    const fromShared = res.notes.includes('key from the shared library');
    const base = { cost: fromShared ? 0 : cost, calls: fromShared ? 0 : res.calls.length, configHash: res.configHash, rMin: rt.settings.rMin, fromShared };
    if (res.status === 'grounded') return { ...base, status: res.partial ? 'partial' : 'ready', result: res };
    if (res.status === 'no_grounding') return { ...base, status: 'no_grounding', reason: res.reason, detail: res.detail };
    return { ...base, status: 'failed', reason: res.reason, detail: [res.detail, ...res.problems].join('; ') };
  } catch (e) {
    if (e instanceof HwError && e.code === 'NOT_CONFIGURED') return { status: 'not_available', reason: 'not_configured', detail: e.publicMessage, cost: 0, calls: 0, fromShared: false };
    if (e instanceof HwError && e.code === 'QUOTA_EXCEEDED') return { status: 'failed', reason: 'quota', detail: e.publicMessage, cost: 0, calls: 0, fromShared: false };
    return { status: 'failed', reason: 'error', detail: describeError(e), cost: 0, calls: 0, fromShared: false };
  }
}

/** Process the queue: claim, build, store, apply to the rubric. Returns how many keys were settled. */
export async function runKeyBuilds(workerId: string, deadline: number): Promise<number> {
  let done = 0;
  while (Date.now() < deadline) {
    const [k] = await claim(workerId, 1);
    if (!k) break;
    await settle(k);
    done++;
  }
  return done;
}

async function settle(k: Claimed): Promise<void> {
  const [q] = await db.select().from(hwQuestion).where(eq(hwQuestion.id, k.question_id)).limit(1);
  if (!q) { await db.execute(sql`UPDATE hw_question_key SET superseded_at = now(), status = 'failed', reason = 'question_removed' WHERE id = ${k.id}`); return; }
  let rt: KeyRuntime | null = null;
  try { rt = keyRuntime(); } catch { rt = null; }
  const out = await buildFor(q, rt);
  await db.transaction(async (tx) => {
    const r = out.result;
    await tx.execute(sql`
      UPDATE hw_question_key SET
        status = ${out.status}, reason = ${out.reason ?? null}, detail = ${out.detail ?? null},
        scheme_source = ${r ? schemeOfSource(r.source) : null},
        key = ${r ? JSON.stringify(r.key) : null}::jsonb,
        citations = ${r ? JSON.stringify(r.citations.map((c) => ({ chunkId: c.chunkId, title: c.textbookTitle, chapter: c.chapter, pageStart: c.pageStart, pageEnd: c.pageEnd, text: c.citationFormat }))) : null}::jsonb,
        verification = ${r ? JSON.stringify(r.verification) : null}::jsonb,
        key_service_version = ${r ? currentKeyServiceVersion() : null},
        config_hash = ${r ? (out.configHash ?? null) : null},
        r_min = ${out.rMin ?? null},
        source_ref = ${r ? sourceRefOf(r) : null},
        passage_hashes = ${r ? JSON.stringify(passageHashesOf(r)) : null}::jsonb,
        from_shared = ${out.fromShared}, cost_paise = ${out.cost}, built_at = now(), locked_at = NULL
       WHERE id = ${k.id}`);
    if (out.calls > 0 || out.cost > 0) {
      await tx.execute(sql`
        INSERT INTO hw_ai_usage_monthly (organization_id, month, cost_paise, key_cost_paise, key_builds)
        VALUES (${q.organizationId}, ${monthOf()}::date, ${out.cost}, ${out.cost}, 1)
        ON CONFLICT (organization_id, month) DO UPDATE SET
          cost_paise = hw_ai_usage_monthly.cost_paise + ${out.cost}, key_cost_paise = hw_ai_usage_monthly.key_cost_paise + ${out.cost}, key_builds = hw_ai_usage_monthly.key_builds + 1`);
    }
    if (out.status === 'ready' && out.result) await applyKey(tx, q, k.id, out.result);
  });
}

const monthOf = () => monthKey();

const BANK_PREFIX = 'bank:';
/** What a key rests on, as hashes: the book text for a textbook key; for an official key, the bank row and the content it had when the key was made. */
export function passageHashesOf(r: Extract<KeyResult, { status: 'grounded' }>): Record<string, string> {
  if (r.officialSource) return { [`${BANK_PREFIX}${r.officialSource.id}`]: r.officialSource.contentHash };
  return Object.fromEntries(r.passages.map((p) => [p.id, sha(p.text)]));
}

function sourceRefOf(r: Extract<KeyResult, { status: 'grounded' }>): string {
  if (r.officialSource) return `official: bank row ${r.officialSource.id}`;
  const books = [...new Set(r.citations.map((c) => `${c.isbn ?? c.contentItemId}|${c.edition ?? ''}`))].sort();
  return `${r.source}: ${books.join(',') || 'given passage'}`;
}

/**
 * A ready key becomes the question's rubric, and the question's scheme source follows it, when (a) the question is still in key mode, (b) it has not
 * changed since the build, and (c) the assignment is still a draft (a published assignment's rubric is frozen). On a published assignment a rebuilt
 * key whose value points are exactly the frozen rubric is re-activated; one that differs is stored but not applied.
 */
async function applyKey(tx: Exec, q: QuestionRow, keyId: string, r: Extract<KeyResult, { status: 'grounded' }>): Promise<void> {
  const [fresh] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, q.id)).limit(1);
  if (!fresh || fresh.rubricMode !== 'key' || questionHash(fresh) !== questionHash(q)) return;
  const [a] = await tx.select({ status: hwAssignment.status }).from(hwAssignment).where(eq(hwAssignment.id, fresh.assignmentId)).limit(1);
  const scheme = schemeOfSource(r.source);
  const rows = rubricRowsOf(r.key);
  const cur = await tx.select().from(hwRubricItem).where(and(eq(hwRubricItem.questionId, fresh.id), isNull(hwRubricItem.retiredAt))).orderBy(hwRubricItem.position);
  // A draft takes the key as its rubric; so does a published question that has no rubric at all yet (nothing was ever marked against one).
  if (a?.status === 'draft' || cur.length === 0) {
    await replaceRubric(tx, fresh.organizationId, fresh.id, rows, 'key');
    await tx.update(hwQuestion).set({ activeKeyId: keyId, schemeSource: scheme }).where(eq(hwQuestion.id, fresh.id));
    await requeueWaiting(tx, fresh);
    return;
  }
  const same = cur.length === rows.length && cur.every((c, i) => c.description.trim() === rows[i].description.trim() && num(c.marks) === rows[i].marks);
  if (same) {
    await tx.update(hwQuestion).set({ activeKeyId: keyId, schemeSource: scheme }).where(eq(hwQuestion.id, fresh.id));
    await requeueWaiting(tx, fresh);
  }
}

/** Answers that were left for the teacher only because the key was not ready are marked now. */
async function requeueWaiting(tx: Exec, q: QuestionRow): Promise<void> {
  const { AI_OFF_PREFIX } = await import('../eligibility/decision');
  const { enqueueGrade } = await import('../jobs/queue');
  const r = await tx.execute(sql`UPDATE hw_answer SET failure_reason = NULL WHERE question_id = ${q.id} AND failure_reason LIKE ${`${AI_OFF_PREFIX}%`}`);
  if (((r as unknown as { rowCount?: number }).rowCount ?? 0) > 0) await enqueueGrade(tx, q.organizationId, q.id, 0);
}

// ── The teacher's view ───────────────────────────────────────────────────────

export interface KeyView {
  mode: 'key' | 'teacher';
  /** What the builder shows. 'teacher' = the teacher's own rubric is in use. */
  status: KeyStatus | 'teacher';
  schemeSource: HwQuestionSchemeSource;
  reason: string | null;
  detail: string | null;
  fromShared: boolean;
  /** Present for 'ready' and 'partial': read-only value points with their marks and citations. */
  valuePoints: Array<{ text: string; marks: number; citations: string[] }>;
  total: number | null;
  /** Why the question will be marked by hand, or null when AI marking can apply (subject to the group being eligible). */
  handMarked: KeyOffReason | null;
}

type KeyRowLite = { id: string; status: KeyStatus; scheme_source: KeySchemeSource | null; reason: string | null; detail: string | null; key: AnswerKey | null; citations: Array<{ chunkId: string; text: string }> | null; from_shared: boolean };

export async function currentKeys(x: Exec, questionIds: string[]): Promise<Map<string, KeyRowLite>> {
  const out = new Map<string, KeyRowLite>();
  if (!questionIds.length) return out;
  const r = await x.execute<KeyRowLite & { question_id: string }>(sql`
    SELECT question_id, id, status, scheme_source, reason, detail, key, citations, from_shared FROM hw_question_key
     WHERE superseded_at IS NULL AND question_id IN (${sql.join(questionIds.map((i) => sql`${i}`), sql`, `)})`);
  for (const row of r.rows) out.set(row.question_id, row);
  return out;
}

const OFF_OF_STATUS: Record<Exclude<KeyStatus, 'ready'>, KeyOffReason> = {
  building: 'key_pending', partial: 'key_partial', no_grounding: 'key_no_grounding', failed: 'key_failed', not_available: 'key_not_available',
};

export function keyViewOf(q: QuestionRow, k: KeyRowLite | undefined): KeyView {
  if (q.rubricMode === 'teacher') {
    return { mode: 'teacher', status: 'teacher', schemeSource: 'teacher_rubric', reason: null, detail: null, fromShared: false, valuePoints: [], total: null, handMarked: 'teacher_rubric' };
  }
  const status: KeyStatus = k?.status ?? 'building';
  const points = (status === 'ready' || status === 'partial') && k?.key ? k.key.valuePoints.map((p) => ({
    text: p.text, marks: p.marks, citations: p.cites.map((c) => (c === 'given' ? 'the passage given with the question' : k.citations?.find((x) => x.chunkId === c)?.text ?? '')).filter(Boolean),
  })) : [];
  return {
    mode: 'key', status, schemeSource: (k?.scheme_source ?? q.schemeSource) as HwQuestionSchemeSource, reason: k?.reason ?? null, detail: k?.detail ?? null, fromShared: k?.from_shared ?? false,
    valuePoints: points, total: points.length ? points.reduce((s, p) => s + p.marks, 0) : null,
    handMarked: status === 'ready' ? null : OFF_OF_STATUS[status],
  };
}

// ── The marking-time backstop ────────────────────────────────────────────────

/**
 * An InkBuddy board-pool question (practice/board.ts) may be AI-marked against its teacher-checked key: a multiple-choice one always (the key is one
 * option; code marks the right and wrong ones, the model only an unclear answer), a written one only while HW_INKBUDDY_POOL_AI_ENABLED is on.
 */
export function boardPoolAiAllowed(q: { organizationId: string; originRef: Record<string, string> | null }): boolean {
  if (q.organizationId !== PRACTICE_ORG_ID || !q.originRef?.poolItemId) return false;
  return q.originRef.objective === '1' || getHwConfig().HW_INKBUDDY_POOL_AI_ENABLED;
}

export type KeyCheck = { ok: true; scheme: SchemeStamp } | { ok: false; reason: KeyOffReason };

const TEACHER_STAMP: SchemeStamp = { source: 'teacher_rubric', keyId: null, keyServiceVersion: null, configHash: null };

/**
 * May a model mark this question against its key? Without calling a model: the active key must be 'ready', built by the key-service version running now,
 * with the settings running now (R_min, models, index), for this very question, from book text that has not changed. If it fails, a rebuild is queued
 * (once). `rt` and `chunks` are injectable for tests.
 */
export async function checkKeyForMarking(x: Exec, q: QuestionRow, opts: { rt?: KeyRuntime | null; enforceTeacherRubric?: boolean; /** false = look only, never queue a rebuild (previews and listings) */ rebuild?: boolean; /** tests: the library passage reader */ libraryPassages?: typeof passageTexts } = {}): Promise<KeyCheck> {
  if (q.rubricMode === 'teacher') {
    const examOverride = q.organizationId === EXAM_ORG_ID && getHwConfig().HW_EXAMS_AUTHORED_AI_ENABLED; // D3 for exams only
    return opts.enforceTeacherRubric === false || getHwConfig().HW_TEACHER_RUBRIC_AI_ENABLED || examOverride || boardPoolAiAllowed(q) ? { ok: true, scheme: TEACHER_STAMP } : { ok: false, reason: 'teacher_rubric' };
  }
  const cur = (await currentKeys(x, [q.id])).get(q.id);
  if (!q.activeKeyId) {
    if (!cur) return { ok: false, reason: 'key_pending' };
    // A published assignment whose key was rebuilt differently, or a key not applied for another reason.
    if (cur.status === 'ready') return { ok: false, reason: 'key_changed' };
    return { ok: false, reason: OFF_OF_STATUS[cur.status] };
  }
  const r = await x.execute<{ id: string; status: KeyStatus; scheme_source: KeySchemeSource; key_service_version: string; config_hash: string; question_hash: string; passage_hashes: Record<string, string> | null }>(sql`
    SELECT id, status, scheme_source, key_service_version, config_hash, question_hash, passage_hashes FROM hw_question_key WHERE id = ${q.activeKeyId}`);
  const k = r.rows[0];
  if (!k || k.status !== 'ready') return { ok: false, reason: 'key_failed' };
  const stale = async (reason: KeyOffReason): Promise<KeyCheck> => {
    // A rebuilt key that is ready but was not applied (its value points differ from the published rubric) waits for the teacher: nothing more to build.
    if (cur && cur.status === 'ready' && cur.id !== k.id) return { ok: false, reason: 'key_changed' };
    // Otherwise rebuild once; the rebuilt key re-activates itself when its value points are the published ones.
    if (opts.rebuild !== false) await queueKey(x, q, null).catch(() => undefined);
    return { ok: false, reason };
  };
  if (k.key_service_version !== currentKeyServiceVersion()) return stale('key_stale_version');
  let rt: KeyRuntime | null;
  try { rt = opts.rt !== undefined ? opts.rt : keyRuntime(); } catch { rt = null; }
  if (!rt) return { ok: false, reason: 'key_not_available' };
  if (k.config_hash !== currentConfigHash(rt)) return stale('key_stale_config');
  if (k.question_hash !== questionHash(q)) return stale('key_stale_question');
  const ids = Object.keys(k.passage_hashes ?? {}).filter((i) => i !== 'given');
  if (k.scheme_source === 'board_scheme_key') {
    // An official key is good only while the bank row it came from is still checked and says what it said then (a revised row goes back to draft).
    const bank = ids.find((i) => i.startsWith(BANK_PREFIX));
    if (!bank) return stale('key_stale_book');
    let valid = false;
    try { valid = await officialSourceValid(x, bank.slice(BANK_PREFIX.length), k.passage_hashes![bank]); } catch { return { ok: false, reason: 'key_stale_book' }; }
    if (!valid) return stale('key_stale_book');
  }
  if (k.scheme_source === 'textbook_key' && ids.length) {
    // A key built through the library hub cites the library's passages; read them there, not in the old Gyankosh content tables (13 Nov 2026:
    // reading them there found nothing, or failed where those tables are not configured, so every InkBuddy key looked stale and nothing was marked).
    let rows: Array<{ id: string; text: string }>;
    try { rows = rt.deps.hub ? await (opts.libraryPassages ?? passageTexts)(ids) : await rt.deps.trio.chunks(ids); } catch (e) {
      console.warn(`[hw] key check: the book text could not be read (${describeError(e)})`);
      return { ok: false, reason: 'key_stale_book' };
    }
    // still good while each cited passage's exact text is in the library (any book's row with that id; ids are unique within a book only)
    const have = new Map<string, Set<string>>();
    for (const c of rows) {
      const s = have.get(c.id) ?? new Set<string>();
      s.add(sha(c.text)); s.add(sha(c.text.normalize('NFC')));
      have.set(c.id, s);
    }
    if (ids.some((i) => !have.get(i)?.has(k.passage_hashes![i]))) return stale('key_stale_book');
  }
  return { ok: true, scheme: { source: k.scheme_source, keyId: k.id, keyServiceVersion: k.key_service_version, configHash: k.config_hash } };
}

/** Switch a question to the teacher's own rubric (draft or published): the key is no longer used; the question is hand-marked during the pilot. */
export async function switchToTeacher(x: Exec, questionId: string): Promise<void> {
  await x.update(hwQuestion).set({ rubricMode: 'teacher', activeKeyId: null, schemeSource: 'teacher_rubric' }).where(eq(hwQuestion.id, questionId));
  await x.execute(sql`UPDATE hw_question_key SET superseded_at = now() WHERE question_id = ${questionId} AND superseded_at IS NULL`);
  // The key's points stay as the teacher's starting point, now theirs to edit.
  await x.execute(sql`UPDATE hw_rubric_item SET source = 'teacher' WHERE question_id = ${questionId} AND retired_at IS NULL AND source = 'key'`);
}

/** The scheme stamp recorded with a suggestion for each answer: from the question's active key, or the teacher's rubric. */
export async function schemeStampsForAnswers(x: Exec, orgId: string, answerIds: string[]): Promise<Map<string, SchemeStamp>> {
  const out = new Map<string, SchemeStamp>();
  if (!answerIds.length) return out;
  const r = await x.execute<{ answer_id: string; rubric_mode: string; scheme_source: KeySchemeSource | null; key_id: string | null; key_service_version: string | null; config_hash: string | null }>(sql`
    SELECT an.id AS answer_id, q.rubric_mode, k.scheme_source, k.id AS key_id, k.key_service_version, k.config_hash
      FROM hw_answer an JOIN hw_question q ON q.id = an.question_id LEFT JOIN hw_question_key k ON k.id = q.active_key_id
     WHERE an.organization_id = ${orgId} AND an.id IN (${sql.join(answerIds.map((i) => sql`${i}`), sql`, `)})`);
  for (const row of r.rows) {
    out.set(row.answer_id, row.rubric_mode === 'key' && row.key_id && row.scheme_source
      ? { source: row.scheme_source, keyId: row.key_id, keyServiceVersion: row.key_service_version, configHash: row.config_hash }
      : TEACHER_STAMP);
  }
  return out;
}
