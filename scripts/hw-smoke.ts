// Handwritten Assignments — smoke test against the REAL Gemini API and REAL R2, using a LOCAL
// database. Runs the production pipeline end to end: upload (storeInk) -> submit -> read job
// -> grade job, then prints transcripts, suggestions, token usage and cost, lists every R2 key
// written, checks a signed URL, and deletes exactly the keys it created (prefix-scoped).
//
//   HW_SMOKE=1 npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local \
//     scripts/hw-smoke.ts [samples-dir=scripts/hw/samples] [--batch] [--keep]
//
// Needs in the env: DATABASE_URL (local, with migration 014), GEMINI_API_KEY (paid tier),
// HW_READ_MODEL, HW_ESCALATE_MODEL, HW_GRADE_MODEL, HW_PRICE_TABLE_JSON, and R2_ACCOUNT_ID,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (a test bucket, or the shared bucket:
// everything stays under hw-assignments/smoke-*/ and is removed at the end).

import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

if (process.env.HW_SMOKE !== '1') {
  console.error('Refusing to run: set HW_SMOKE=1. This calls the real Gemini API (costs money) and writes to R2.');
  process.exit(2);
}
if (!process.env.DATABASE_URL || !/@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL)) {
  console.error('Refusing to run: DATABASE_URL must point at a local database.');
  process.exit(2);
}
const BATCH = process.argv.includes('--batch');
const KEEP = process.argv.includes('--keep');
process.env.HW_BATCH_ENABLED = BATCH ? 'true' : 'false';
process.env.HW_GRADE_DEBOUNCE_SECONDS = '0';
process.env.HW_BATCH_POLL_SECONDS = '15';

const SAMPLES_DIR = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'scripts/hw/samples';

// One question per synthetic sample (scripts/hw/make-synthetic-samples.py).
const QUESTIONS = [
  {
    sample: 'en-photosynthesis', type: 'short' as const, marks: 2, language: 'en' as const,
    prompt: 'What is photosynthesis?', model: 'Plants make their own food using sunlight and water.',
    rubric: [{ kind: 'key_point' as const, description: 'Plants make their own food', marks: 1 }, { kind: 'key_point' as const, description: 'Uses sunlight (and water)', marks: 1 }],
  },
  {
    sample: 'en-capital', type: 'short' as const, marks: 2, language: 'en' as const,
    prompt: 'What is the capital of India?', model: 'New Delhi is the capital of India.',
    rubric: [{ kind: 'key_point' as const, description: 'Names New Delhi', marks: 2 }],
  },
  {
    sample: 'hi-paryavaran', type: 'short' as const, marks: 2, language: 'hi' as const,
    prompt: 'पेड़ हमारे लिए क्यों ज़रूरी हैं?', model: 'पेड़ हमें ऑक्सीजन देते हैं, इसलिए हमें पेड़ लगाने चाहिए।',
    rubric: [{ kind: 'key_point' as const, description: 'पेड़ ऑक्सीजन देते हैं', marks: 1 }, { kind: 'key_point' as const, description: 'पेड़ लगाने की बात', marks: 1 }],
  },
];

async function main(): Promise<void> {
  // Feature modules read the env at load time, so they load after the settings above.
  const assignments = await import('@/lib/hw/services/assignments');
  const submissions = await import('@/lib/hw/services/submissions');
  const { drain } = await import('@/lib/hw/jobs/runner');
  const { signedReadUrl } = await import('@/lib/hw/storage/r2');
  const { assertHwKey } = await import('@/lib/hw/storage/keys');
  const { r2Client } = await import('@/lib/services/r2');
  const { encodeInk } = await import('@/lib/hw/ink/stroke-format');
  const { scoreSample } = await import('@/lib/hw/eval/metrics');
  const { getPool } = await import('@/lib/db/connection');

  const raw = new Pool({ connectionString: process.env.DATABASE_URL });
  const org = `smoke-${randomUUID().slice(0, 8)}`;
  const prefix = `hw-assignments/${org}/`;
  const u = (k: string) => `${org}-${k}`;
  console.log(`Smoke institution ${org} · ${BATCH ? 'Batch API' : 'synchronous'} reads · R2 prefix ${prefix}\n`);

  try {
    // ── Institution, people, class ──────────────────────────────────────────
    await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org]);
    for (const [k, role] of [['t', 'teacher'], ['s', 'student']]) {
      await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)`, [u(k), `Smoke ${k}`, `${u(k)}@example.test`, role]);
      await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`, [`m-${u(k)}`, org, u(k), role]);
    }
    await raw.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ($1, $2, 'Class 9', 9)`, [u('c9'), org]);
    await raw.query(`INSERT INTO student_enrollments (id, organization_id, user_id, class_id, status) VALUES ($1, $2, $3, $4, 'active')`, [u('e'), org, u('s'), u('c9')]);
    await raw.query(`INSERT INTO hw_class_teacher (id, organization_id, class_id, teacher_id) VALUES ($1, $2, $3, $4)`, [u('l'), org, u('c9'), u('t')]);
    await raw.query(`INSERT INTO hw_tenant_quota (organization_id, enabled, monthly_answer_quota) VALUES ($1, true, 100)`, [org]);
    const teacher = { userId: u('t'), orgId: org, role: 'teacher' as const, isPlatformStaff: false };
    const student = { userId: u('s'), orgId: org, role: 'student' as const, isPlatformStaff: false };

    // ── Teacher builds and publishes ────────────────────────────────────────
    const { id: assignmentId } = await assignments.createAssignment(teacher, { classId: u('c9'), sectionId: null, subject: 'Science', title: 'Smoke test', allowedModes: ['ink', 'typed'] });
    const qids: string[] = [];
    for (const q of QUESTIONS) {
      const { id } = await assignments.addQuestion(teacher, assignmentId, { type: q.type, prompt: q.prompt, marks: q.marks, modelAnswer: q.model, languageHint: q.language });
      await assignments.setRubric(teacher, id, q.rubric);
      qids.push(id);
    }
    await assignments.publishAssignment(teacher, assignmentId);

    // ── Student "writes": the sample image is the render, uploaded for real ─
    const started = await submissions.startSubmission(student, assignmentId);
    const sid = started.submission.id;
    const inkGz = new Uint8Array(gzipSync(JSON.stringify(encodeInk({ w: 900, h: 200, strokes: [{ t0: 0, tool: 'pen', points: [{ x: 10, y: 10, p: 0.5, t: 0 }, { x: 40, y: 20, p: 0.5, t: 16 }] }] }))));
    for (let i = 0; i < QUESTIONS.length; i++) {
      const img = join(SAMPLES_DIR, QUESTIONS[i].sample, 'image.png');
      if (!existsSync(img)) throw new Error(`missing ${img}; run scripts/hw/make-synthetic-samples.py first`);
      const r = await submissions.storeInk(student, sid, qids[i], inkGz, new Uint8Array(readFileSync(img)));
      console.log(`uploaded Q${i + 1}: render ${r.renderWidth}x${r.renderHeight}, ${r.renderBytes} bytes; ink ${r.inkBytes} bytes`);
    }
    await submissions.submit(student, sid);

    // ── Run the queue until everything has settled ──────────────────────────
    const deadline = Date.now() + (BATCH ? 30 * 60_000 : 5 * 60_000);
    for (;;) {
      await raw.query(`UPDATE hw_ai_job SET run_after = now() WHERE organization_id = $1 AND status = 'queued'`, [org]);
      const s = await drain('smoke', 50_000);
      if (s.errors.length) console.error('drain errors:', s.errors);
      const { rows } = await raw.query(`SELECT count(*)::int AS n FROM hw_ai_job WHERE organization_id = $1 AND status IN ('queued', 'running', 'batch_pending')`, [org]);
      if (rows[0].n === 0) break;
      if (Date.now() > deadline) throw new Error('timed out waiting for jobs');
      await new Promise((r) => setTimeout(r, BATCH ? 15_000 : 2_000));
    }

    // ── Results ─────────────────────────────────────────────────────────────
    console.log('\nTranscripts:');
    const answers = (await raw.query(`SELECT a.id, q.position, a.transcript, a.transcript_status, a.transcript_confidence, a.unclear_count, a.reader_engine, a.reader_tier, a.failure_reason, a.render_key
      FROM hw_answer a JOIN hw_question q ON q.id = a.question_id WHERE a.submission_id = $1 ORDER BY q.position`, [sid])).rows;
    for (const a of answers) {
      const truth = readFileSync(join(SAMPLES_DIR, QUESTIONS[a.position].sample, 'truth.txt'), 'utf8');
      const sc = a.transcript === null ? null : scoreSample(a.transcript, truth);
      console.log(`  Q${a.position + 1} [${a.transcript_status}, tier ${a.reader_tier}, conf ${a.transcript_confidence}, [?]=${a.unclear_count}, CER ${sc ? (sc.cer * 100).toFixed(1) + '%' : 'n/a'}] ${a.reader_engine ?? ''}`);
      console.log(`     read : ${JSON.stringify(a.transcript)}`);
      console.log(`     truth: ${JSON.stringify(truth)}`);
      if (a.failure_reason) console.log(`     note : ${a.failure_reason}`);
    }

    console.log('\nAI suggestions (never final grades):');
    const sugg = (await raw.query(`SELECT q.position, g.model, g.suggested_marks, g.confidence, g.items, g.validation_notes
      FROM hw_ai_grade g JOIN hw_answer a ON a.id = g.answer_id JOIN hw_question q ON q.id = a.question_id WHERE a.submission_id = $1 ORDER BY q.position`, [sid])).rows;
    for (const g of sugg) {
      console.log(`  Q${g.position + 1}: ${g.suggested_marks} marks, confidence ${g.confidence} (${g.model})`);
      for (const it of g.items) console.log(`     - ${it.verdict.padEnd(7)} ${it.marks}  "${it.quote}"`);
      if (g.validation_notes.length) console.log(`     notes: ${g.validation_notes.join(' | ')}`);
    }
    const finals = (await raw.query(`SELECT count(*)::int AS n FROM hw_grade g JOIN hw_answer a ON a.id = g.answer_id WHERE a.submission_id = $1`, [sid])).rows[0].n;
    console.log(`  final grades written by the pipeline: ${finals} (must be 0)`);

    console.log('\nToken usage and cost (from the provider responses):');
    const jobs = (await raw.query(`SELECT kind, status, model, tokens_in, tokens_cached, tokens_out, cost_estimate_paise, error FROM hw_ai_job WHERE organization_id = $1 ORDER BY created_at`, [org])).rows;
    for (const j of jobs) console.log(`  ${j.kind.padEnd(6)} ${j.status.padEnd(6)} ${String(j.model).padEnd(24)} in ${j.tokens_in} (cached ${j.tokens_cached}) out ${j.tokens_out} · ₹${(Number(j.cost_estimate_paise) / 100).toFixed(4)}${j.error ? ` · ${j.error}` : ''}`);
    const usage = (await raw.query(`SELECT pages_read, answers_graded, tokens_in, tokens_cached, tokens_out, cost_paise FROM hw_ai_usage_monthly WHERE organization_id = $1`, [org])).rows[0];
    console.log(`  month total: ${JSON.stringify(usage)}`);
    if (usage) console.log(`  per answer: ₹${(Number(usage.cost_paise) / 100 / QUESTIONS.length).toFixed(4)}`);

    // ── R2: what was written, and can it be read back through a signed URL? ─
    console.log('\nR2 keys written:');
    const listed = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: prefix }));
    const keys = (listed.Contents ?? []).map((o) => o.Key!).filter(Boolean);
    for (const k of keys) console.log(`  ${k}`);
    console.log(`  ${keys.length} keys, all under hw-assignments/: ${keys.every((k) => k.startsWith('hw-assignments/'))}`);
    const renderKey = answers.find((a) => a.render_key)?.render_key;
    if (renderKey) {
      const res = await fetch(await signedReadUrl(renderKey));
      console.log(`  signed URL for ${renderKey}: HTTP ${res.status}, ${res.headers.get('content-type')}`);
    }

    if (!KEEP && keys.length) {
      keys.forEach(assertHwKey);
      const del = await r2Client.send(new DeleteObjectsCommand({ Bucket: process.env.R2_BUCKET_NAME, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
      console.log(`\nDeleted ${del.Deleted?.length ?? 0} smoke objects under ${prefix}${del.Errors?.length ? `; ${del.Errors.length} errors: ${JSON.stringify(del.Errors)}` : ''}`);
    }
  } finally {
    await raw.end();
    await getPool().end();
  }
}

main().catch((e) => {
  console.error('smoke failed:', e);
  process.exit(1);
});
