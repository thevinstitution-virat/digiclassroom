-- Self-practice pilot: read-only monitoring queries (docs/hw-eval/self-practice-pilot.md). SELECTs only; safe to run any time.
--   psql "$DATABASE_URL" -f docs/hw-eval/self-practice-pilot-queries.sql
-- Rupees are paise / 100. The practice institution's id is 'virat-gyankosh-practice'.

\echo '1. Trials by state (spent is reading and marking only; answer keys are counted in query 6)'
SELECT state, count(*) AS learners,
       round(avg(spent_paise) / 100, 2) AS avg_spent_rupees, round(max(spent_paise) / 100, 2) AS max_spent_rupees,
       min(started_at)::date AS first_started, max(ends_at)::date AS last_ends
  FROM hw_practice_trial GROUP BY state ORDER BY state;

\echo '2. Questions started per learner (the cap is HW_SELF_PRACTICE_MAX_ATTEMPTS)'
SELECT created_by AS learner, count(*) AS questions, min(created_at)::date AS first_day, max(created_at)::date AS last_day
  FROM hw_assignment WHERE organization_id = 'virat-gyankosh-practice'
 GROUP BY created_by ORDER BY questions DESC LIMIT 20;

\echo '3. Where handed-in work stands (returned = the learner has a mark; ready_for_review/graded for a long time = held back)'
SELECT status, count(*) AS submissions,
       count(*) FILTER (WHERE updated_at < now() - interval '1 hour') AS older_than_1h
  FROM hw_submission WHERE organization_id = 'virat-gyankosh-practice' AND status <> 'draft'
 GROUP BY status ORDER BY status;

\echo '4. Why answers have no mark (the reason shown to the learner or the system, newest first)'
SELECT transcript_status, left(coalesce(failure_reason, '-'), 90) AS reason, count(*) AS answers
  FROM hw_answer WHERE organization_id = 'virat-gyankosh-practice' AND (failure_reason IS NOT NULL OR transcript_status <> 'done')
 GROUP BY 1, 2 ORDER BY answers DESC LIMIT 15;

\echo '5. Jobs that failed in the last 24 hours'
SELECT kind, left(coalesce(error, '-'), 90) AS error, count(*) AS jobs, max(updated_at) AS latest
  FROM hw_ai_job WHERE organization_id = 'virat-gyankosh-practice' AND status = 'failed' AND updated_at > now() - interval '24 hours'
 GROUP BY 1, 2 ORDER BY jobs DESC LIMIT 15;

\echo '6. Answer keys: state, how many came from the shared library, and what the builds cost'
SELECT status, count(*) AS keys, count(*) FILTER (WHERE from_shared) AS from_shared,
       round(sum(cost_paise) / 100, 2) AS cost_rupees, round(avg(cost_paise) FILTER (WHERE NOT from_shared) / 100, 3) AS avg_rupees_per_built_key
  FROM hw_question_key WHERE organization_id = 'virat-gyankosh-practice' AND superseded_at IS NULL
 GROUP BY status ORDER BY status;

\echo '7. The practice institution''s spend this month against its ceiling'
SELECT u.month, round(u.cost_paise / 100, 2) AS spent_rupees, round(u.key_cost_paise / 100, 2) AS of_which_keys_rupees,
       round(q.monthly_budget_paise / 100.0, 2) AS ceiling_rupees, u.pages_read, u.answers_graded
  FROM hw_ai_usage_monthly u LEFT JOIN hw_tenant_quota q ON q.organization_id = u.organization_id
 WHERE u.organization_id = 'virat-gyankosh-practice' ORDER BY u.month DESC LIMIT 3;

\echo '8. Marks given without a teacher, as a share of the question total (look for a pile-up at 0 or at the full mark)'
SELECT round(g.marks / nullif(q.marks, 0), 1) AS share_of_total, count(*) AS answers
  FROM hw_grade g JOIN hw_answer a ON a.id = g.answer_id JOIN hw_question q ON q.id = a.question_id
 WHERE g.organization_id = 'virat-gyankosh-practice'
 GROUP BY 1 ORDER BY 1;
