// Seeds the SCRATCH database (localhost:55436) with fake data for the screen walkthrough. Test credentials only; nothing here touches a real service.
const { createRequire } = require('module');
const req = createRequire('H:/Trio/worktrees/DCP-hw-wt/package.json');
const { Client } = req('pg');
const { hashPassword } = req('better-auth/crypto');

const PASSWORD = 'Walkthrough#2026';
const A = 'a'.repeat(64);
const org = 'wt-org';
const U = { sa: 'wt-sa', ia: 'wt-ia', tc: 'wt-tc', st: 'wt-st', rt: 'wt-rt', pa: 'wt-pa' };
const day = (off) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10);

(async () => {
  const c = new Client({ connectionString: 'postgres://postgres:scratch@localhost:55436/digiclassroom' });
  await c.connect();
  const q = (sql, p) => c.query(sql, p);
  // clean previous walkthrough rows
  await q('ALTER TABLE "user" DISABLE TRIGGER trg_protect_super_admin'); // scratch database only
  // scratch database only: drop the institutions the test suites left behind, so the owner's tables show only this walkthrough's data
  await q(`DELETE FROM organization WHERE id <> $1`, [org]).catch((e) => console.log('org cleanup skipped:', e.message));
  await q(`DELETE FROM hw_monitor_alert WHERE group_key LIKE 'wtscience|%'`);
  await q(`DELETE FROM hw_monitor_group_daily WHERE organization_id = $1`, [org]);
  await q(`DELETE FROM hw_eligibility WHERE group_key LIKE 'wtscience|%'`);
  await q(`DELETE FROM hw_eval_rater WHERE user_id = $1`, [U.rt]);
  await q(`DELETE FROM organization WHERE id = $1`, [org]);
  await q(`DELETE FROM "user" WHERE id = ANY($1)`, [Object.values(U)]);

  const hash = await hashPassword(PASSWORD);
  const names = { sa: 'Super Admin', ia: 'Institution Admin', tc: 'Teacher Tara', st: 'Student Sam', rt: 'Rater Ravi', pa: 'Parent Priya' };
  for (const k of Object.keys(U)) {
    await q(`INSERT INTO "user" (id, name, email, email_verified, role) VALUES ($1, $2, $3, true, $4)`, [U[k], names[k], `${U[k]}@walkthrough.test`, k === 'tc' ? 'teacher' : k === 'pa' ? 'parent' : 'student']);
    await q(`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES ($1, $2, 'credential', $3, $4, now(), now())`, [`acc-${U[k]}`, U[k], U[k], hash]);
  }
  await q(`UPDATE "user" SET role = 'super_admin' WHERE id = $1`, [U.sa]);
  await q('ALTER TABLE "user" ENABLE TRIGGER trg_protect_super_admin');

  await q(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, 'Walkthrough School', 'walkthrough-school', now())`, [org]);
  for (const [k, role] of [['ia', 'owner'], ['tc', 'teacher'], ['st', 'student'], ['pa', 'parent']]) await q(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`, [`m-${U[k]}`, org, U[k], role]);
  await q(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ('wt-c9', $1, 'Class 9', 9), ('wt-c8', $1, 'Class 8', 8)`, [org]);
  await q(`INSERT INTO institution_sections (id, organization_id, class_id, name) VALUES ('wt-c9a', $1, 'wt-c9', 'A'), ('wt-c9b', $1, 'wt-c9', 'B')`, [org]);
  await q(`INSERT INTO student_enrollments (id, organization_id, user_id, class_id, status) VALUES ('wt-e1', $1, $2, 'wt-c9', 'active')`, [org, U.st]);
  await q(`INSERT INTO hw_class_teacher (id, organization_id, class_id, teacher_id, subject) VALUES ('wt-l1', $1, 'wt-c9', $2, 'Science')`, [org, U.tc]);
  await q(`INSERT INTO hw_tenant_quota (organization_id, enabled, monthly_answer_quota, monthly_budget_paise) VALUES ($1, true, 1000, 5000) ON CONFLICT (organization_id) DO UPDATE SET enabled = true, monthly_budget_paise = 5000`, [org]);
  const month = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7) + '-01';
  await q(`INSERT INTO hw_ai_usage_monthly (organization_id, month, pages_read, answers_graded, cost_paise, key_builds, key_cost_paise) VALUES ($1, $2, 40, 120, 4200, 2, 600) ON CONFLICT (organization_id, month) DO UPDATE SET cost_paise = 4200, key_builds = 2, key_cost_paise = 600`, [org, month]);

  // ── builder assignment (draft): one question per key status, plus the teacher's own rubric ──
  await q(`INSERT INTO hw_assignment (id, organization_id, class_id, subject, title, status, allowed_modes, created_by) VALUES ('wt-a-build', $1, 'wt-c9', 'Science', 'Builder walkthrough', 'draft', ARRAY['typed'], $2)`, [org, U.tc]);
  const vp = [
    { id: 'p1', text: 'Poverty line is based on minimum calorie requirement', marks: 1, kind: 'key_point', cites: ['c1'], acceptedAlternatives: [] },
    { id: 'p2', text: '2400 calories in rural areas and 2100 in urban areas', marks: 1, kind: 'key_point', cites: ['c1'], acceptedAlternatives: [] },
  ];
  const cites = [{ chunkId: 'c1', title: 'Understanding Society: India and Beyond', chapter: 'Chapter 3', pageStart: 41, pageEnd: 41, text: 'Understanding Society: India and Beyond (Class 9, English), Ch. 3, p. 41' }];
  const statuses = [['building', null], ['ready', 'ready'], ['partial', 'partial'], ['no_grounding', 'no_book'], ['failed', 'writer_output'], ['not_available', 'not_configured']];
  let pos = 0;
  for (const [status, reason] of statuses) {
    const id = `wt-q-${status}`;
    await q(`INSERT INTO hw_question (id, organization_id, assignment_id, position, type, prompt, marks, rubric_mode) VALUES ($1, $2, 'wt-a-build', $3, 'short', $4, 2, 'key')`, [id, org, pos++, `How is the poverty line estimated in India? (key status: ${status})`]);
    const full = status === 'ready' || status === 'partial';
    await q(`INSERT INTO hw_question_key (id, organization_id, question_id, status, reason, detail, scheme_source, question_hash, key, citations, key_service_version, config_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)`,
      [`wt-k-${status}`, org, id, status, reason, status === 'failed' ? 'writer output unusable; missing value points' : null, full ? 'textbook_key' : null, A,
        full ? JSON.stringify({ referenceAnswer: 'Calorie norm.', valuePoints: vp }) : null, full ? JSON.stringify(cites) : null, full ? 'v' : null, full ? A : null]);
    if (status === 'ready') {
      await q(`UPDATE hw_question SET scheme_source = 'textbook_key', active_key_id = 'wt-k-ready' WHERE id = $1`, [id]);
      for (const [i, p] of vp.entries()) await q(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks, source) VALUES ($1, $2, $3, $4, 'key_point', $5, $6, 'key')`, [`wt-r-${i}`, org, id, i, p.text, p.marks]);
    }
  }
  await q(`INSERT INTO hw_question (id, organization_id, assignment_id, position, type, prompt, marks, rubric_mode, model_answer) VALUES ('wt-q-own', $1, 'wt-a-build', $2, 'short', 'Name two causes of poverty. (own rubric)', 2, 'teacher', 'Unemployment and illiteracy.')`, [org, pos++]);
  for (const [i, t] of ['Unemployment', 'Illiteracy'].entries()) await q(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks, source) VALUES ($1, $2, 'wt-q-own', $3, 'key_point', $4, 1, 'teacher')`, [`wt-r-own${i}`, org, i, t]);

  // ── marking assignment (published): three questions, each with a student's answer and a reason there is no AI suggestion ──
  await q(`INSERT INTO hw_assignment (id, organization_id, class_id, subject, title, status, allowed_modes, created_by) VALUES ('wt-a-mark', $1, 'wt-c9', 'Science', 'Marking walkthrough', 'draft', ARRAY['typed'], $2)`, [org, U.tc]);
  const mq = [
    ['wt-m1', 'teacher', 'Name two causes of poverty. (group not eligible)', null],
    ['wt-m2', 'key', 'How is the poverty line estimated? (key no longer supported)', 'AI quota reached'],
    ['wt-m3', 'teacher', 'Why is education important? (quota reached)', 'AI quota reached (₹50.00 of ₹50.00 this month); please mark by hand.'],
  ];
  for (const [i, [id, mode, prompt]] of mq.entries()) {
    await q(`INSERT INTO hw_question (id, organization_id, assignment_id, position, type, prompt, marks, rubric_mode) VALUES ($1, $2, 'wt-a-mark', $3, 'short', $4, 2, $5)`, [id, org, i, prompt, mode]);
    for (const j of [0, 1]) await q(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks, source) VALUES ($1, $2, $3, $4, 'key_point', $5, 1, $6)`, [`${id}-r${j}`, org, id, j, `Key point ${j + 1} of ${id}`, mode === 'key' ? 'key' : 'teacher']);
  }
  await q(`INSERT INTO hw_question_key (id, organization_id, question_id, status, scheme_source, question_hash, key, key_service_version, config_hash) VALUES ('wt-k-m2', $1, 'wt-m2', 'ready', 'textbook_key', $2, $3::jsonb, 'old-prompts+old-checks', $4)`, [org, A, JSON.stringify({ referenceAnswer: 'x', valuePoints: vp }), A]);
  await q(`UPDATE hw_question SET active_key_id = 'wt-k-m2', scheme_source = 'textbook_key' WHERE id = 'wt-m2'`);
  await q(`UPDATE hw_assignment SET status = 'published' WHERE id = 'wt-a-mark'`);
  await q(`INSERT INTO hw_submission (id, organization_id, assignment_id, student_id, status, submitted_at) VALUES ('wt-s1', $1, 'wt-a-mark', $2, 'ready_for_review', now())`, [org, U.st]);
  for (const [i, [id, , , fail]] of mq.entries()) {
    await q(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, typed_text, transcript, transcript_status, failure_reason) VALUES ($1, $2, 'wt-s1', $3, 'typed', $4, $4, 'done', $5)`,
      [`wt-ans${i}`, org, id, 'Because unemployment and illiteracy keep people poor.', i === 2 ? fail : null]);
  }

  // an AI suggestion for the first marking answer (shown when eligibility is not enforced)
  await q(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence) VALUES ('wt-ag1', $1, 'wt-ans0', 'gemini-3.5-flash-lite', 'grade.v1', (SELECT rubric_version FROM hw_question WHERE id = 'wt-m1'), $2::jsonb, 2, 0.82)`, [org, JSON.stringify([{ rubric_item_id: 'wt-m1-r0', verdict: 'met', quote: 'unemployment', marks: 1, confidence: 0.9 }, { rubric_item_id: 'wt-m1-r1', verdict: 'met', quote: 'illiteracy', marks: 1, confidence: 0.75 }])]);
  // ── student and parent screens: one assignment to do (with a passage), one already returned ──
  const passage = 'The poverty line is the money a family needs to buy a minimum amount of food, clothing and shelter. In 2011 it was about Rs 816 a month in villages.';
  await q(`INSERT INTO hw_assignment (id, organization_id, class_id, subject, title, status, allowed_modes, created_by, due_at) VALUES ('wt-a-todo', $1, 'wt-c9', 'Science', 'Reading and answer (passage)', 'draft', ARRAY['typed'], $2, now() + interval '3 days'), ('wt-a-ret', $1, 'wt-c9', 'Science', 'Returned homework', 'draft', ARRAY['typed'], $2, now() - interval '2 days')`, [org, U.tc]);
  await q(`INSERT INTO hw_question (id, organization_id, assignment_id, position, type, prompt, passage, marks, rubric_mode) VALUES ('wt-t1', $1, 'wt-a-todo', 0, 'short', 'According to the passage, what is the poverty line?', $2, 2, 'teacher'), ('wt-rq1', $1, 'wt-a-ret', 0, 'short', 'Name two causes of poverty.', NULL, 2, 'teacher')`, [org, passage]);
  for (const [qid, i] of [['wt-t1', 0], ['wt-t1', 1], ['wt-rq1', 0], ['wt-rq1', 1]]) await q(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks, source) VALUES ($1, $2, $3, $4, 'key_point', $5, 1, 'teacher')`, [`wt-ri-${qid}-${i}`, org, qid, i, `Key point ${i + 1}`]);
  await q(`UPDATE hw_assignment SET status = 'published' WHERE id IN ('wt-a-todo', 'wt-a-ret')`);
  await q(`INSERT INTO hw_submission (id, organization_id, assignment_id, student_id, status, submitted_at) VALUES ('wt-s2', $1, 'wt-a-ret', $2, 'graded', now() - interval '1 day')`, [org, U.st]);
  await q(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, typed_text, transcript, transcript_status) VALUES ('wt-ans-r1', $1, 'wt-s2', 'wt-rq1', 'typed', 'Unemployment and illiteracy', 'Unemployment and illiteracy', 'done')`, [org]);
  await q(`INSERT INTO hw_grade (answer_id, organization_id, marks, item_marks, comment, source, graded_by) VALUES ('wt-ans-r1', $1, 1.5, $2::jsonb, 'Good start. Add one example for each cause.', 'manual', $3)`, [org, JSON.stringify([{ rubric_item_id: 'wt-ri-wt-rq1-0', marks: 1 }, { rubric_item_id: 'wt-ri-wt-rq1-1', marks: 0.5 }]), U.tc]);
  await q(`UPDATE hw_submission SET status = 'returned' WHERE id = 'wt-s2'`);
  await q(`INSERT INTO hw_guardian_link (id, organization_id, guardian_user_id, student_user_id, created_by) VALUES ('wt-gl1', $1, $2, $3, $4)`, [org, U.pa, U.st, U.ia]);

  // ── monitoring for the institution view (one group big enough to show, one too small) and for the owner ──
  const grp = (key, d, over) => {
    const [subject, type, lang, src] = key.split('|');
    const v = { answers_marked: 20, suggestions_shown: 20, accepted_unchanged: 14, accepted_edited: 6, marked_by_hand: 0, marked_by_rule: 0, overrides: 6, large_overrides: 1, override_abs_sum: 7, transcript_fixes: 2, jobs_total: 5, jobs_failed: 0, actual_cost_paise: 120, ...over };
    const cols = Object.keys(v);
    return q(`INSERT INTO hw_monitor_group_daily (day, organization_id, group_key, subject, question_type, language, scheme_source, config_hash, ${cols.join(',')}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${cols.map((_, i) => `$${i + 9}`).join(',')})`,
      [d, org, key, subject, type, lang, src, A, ...cols.map((k) => v[k])]);
  };
  for (let i = -6; i <= 0; i++) await grp('wtscience|short|en|textbook_key', day(i), {});
  await grp('wtscience|long|hi|teacher_rubric', day(0), { answers_marked: 4, suggestions_shown: 0, accepted_unchanged: 0, accepted_edited: 0, marked_by_hand: 4, overrides: 0, large_overrides: 0, override_abs_sum: 0, transcript_fixes: 0 });

  // owner: eligibility, gate result, run, alert
  const gid = 'wt-gate-1';
  await q(`INSERT INTO hw_eval_gate_result (id, group_key, subject, question_type, language, scheme_source, verdict, checks, run_ids, dataset_versions, production_fingerprint, report_sha256, imported_by)
           VALUES ($1, 'wtscience|short|en|textbook_key', 'wtscience', 'short', 'en', 'textbook_key', 'eligible', $2::jsonb, ARRAY['run_wt_mark1'], ARRAY['wt-set@v1'], $3, $3, 'cli:walkthrough') ON CONFLICT DO NOTHING`,
    [gid, JSON.stringify([{ gate: 'QWK, 2-mark questions', state: 'pass', detail: '0.86 (≥ 0.80)' }, { gate: 'Large errors', state: 'pass', detail: '3.1% (≤ 0.05)' }, { gate: 'Injection', state: 'insufficient', detail: 'n=0' }]), A]);
  await q(`INSERT INTO hw_eval_run (run_id, mode, status, dataset_ref, imported_by, source_sha256, cost_paise, counts, config_hash, repeat) VALUES ('run_wt_mark1', 'mark', 'completed', 'wt-set@v1', 'cli:walkthrough', $1, 250, '{"ok": 93, "failed": 0}'::jsonb, $2, 1) ON CONFLICT DO NOTHING`, [A, A]);
  await q(`INSERT INTO hw_eligibility (group_key, subject, question_type, language, scheme_source, status, config_hash, gate_result_id, dataset_versions, decided_by, reason)
           VALUES ('wtscience|short|en|textbook_key', 'wtscience', 'short', 'en', 'textbook_key', 'eligible', $1, $2, ARRAY['wt-set@v1'], $3, 'Passed every gate on wt-set@v1.') ON CONFLICT (group_key) DO NOTHING`, [A, gid, U.sa]);
  await q(`INSERT INTO hw_monitor_alert (group_key, code, severity, value, threshold, sample_size, config_hash, demoted) VALUES ('wtscience|short|en|textbook_key', 'override_rate', 'demote', 0.4, 0.3, 140, $1, false)`, [A]);

  // rater
  await q(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ('Rater-Ravi', $1, ARRAY['transcribe','mark:science'], $2)`, [U.rt, U.sa]);
  console.log(JSON.stringify({ ok: true, users: Object.fromEntries(Object.entries(U).map(([k, v]) => [k, `${v}@walkthrough.test`])) }));
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
