// Virat Evaluator — live report: daily monitoring and shadow-mode comparisons, from the app
// database (read-only queries).
//
//   npm run hw:eval:live -w apps/api -- [--days 30] [--org <organizationId>] [--out live.md]
//
// Aggregates only; answer text appears nowhere in the output.

import { writeFileSync } from 'node:fs';
import { Pool } from 'pg';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const { renderLiveMarkdown, summariseMonitoring, summariseShadow } = await import('@/lib/hw/eval/live');
  const days = Math.max(1, Math.min(366, Number(arg('days', '30'))));
  const org = arg('org') ?? null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query('BEGIN TRANSACTION READ ONLY');
    const mon = await c.query(`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, subject, question_type, answers_marked, ai_suggested, overrides, override_abs_sum::float AS abs_sum, transcript_fixes, misread_flags
        FROM hw_eval_monitor_daily
       WHERE day >= (now() AT TIME ZONE 'Asia/Kolkata')::date - $1::int AND ($2::text IS NULL OR organization_id = $2)`, [days, org]);
    const sh = await c.query(`
      SELECT s.kind, s.candidate_config_hash, s.status, s.predicted_transcript, s.production_transcript, a.transcript AS current_transcript,
             EXISTS (SELECT 1 FROM hw_transcript_revision r WHERE r.answer_id = s.answer_id AND r.source = 'teacher_edit' AND r.created_at > s.created_at) AS corrected,
             s.predicted_marks::float, s.production_marks::float, s.final_marks::float, s.cost_paise::float
        FROM hw_eval_shadow_result s JOIN hw_answer a ON a.id = s.answer_id
       WHERE s.created_at >= now() - make_interval(days => $1::int) AND ($2::text IS NULL OR s.organization_id = $2)`, [days, org]);
    await c.query('COMMIT');
    const md = renderLiveMarkdown({
      from: new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10),
      monitoring: summariseMonitoring(mon.rows.map((r) => ({ day: r.day, subject: r.subject, questionType: r.question_type, answersMarked: r.answers_marked, aiSuggested: r.ai_suggested, overrides: r.overrides, overrideAbsSum: r.abs_sum, transcriptFixes: r.transcript_fixes, misreadFlags: r.misread_flags }))),
      shadow: summariseShadow(sh.rows.map((r) => ({
        kind: r.kind, configHash: r.candidate_config_hash, status: r.status, predictedTranscript: r.predicted_transcript, productionTranscript: r.production_transcript,
        currentTranscript: r.current_transcript, teacherCorrected: r.corrected, predictedMarks: r.predicted_marks, productionMarks: r.production_marks, finalMarks: r.final_marks, costPaise: r.cost_paise,
      }))),
    });
    const out = arg('out');
    if (out) { writeFileSync(out, md); console.log(`written ${out}`); } else console.log(md);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
