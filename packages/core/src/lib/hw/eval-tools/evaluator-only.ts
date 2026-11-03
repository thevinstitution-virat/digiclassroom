// "Evaluator only" accounts (roadmap task 3.2, isolation). An invited volunteer signs up as a bare account (role 'student', the
// default every sign-up gets, no institution, no class) and becomes a rater when the invitation is accepted. Such a person has no
// reason to be on any product page, so the dashboard router sends them to /evaluate and the dashboard layout turns every
// /dashboard page away.
//
// Deliberately narrow, so nobody is locked out of something they use: it applies only to an ACTIVE rater whose rater row came from
// an accepted invitation, whose account has no institution membership and no enrolment, and whose role is still the default
// 'student'. A teacher, admin, super admin, or a learner who was added as a rater by hand keeps their dashboards.
// This is about pages. It does not change what any API allows: an account with no membership already gets nothing institution-
// scoped from the product APIs.

import { sql } from 'drizzle-orm';
import { db } from '@/db';

export async function isEvaluatorOnly(userId: string): Promise<boolean> {
  const res = await db.execute(sql`
    SELECT 1
      FROM hw_eval_rater r
     WHERE r.user_id = ${userId}
       AND r.active
       AND EXISTS (SELECT 1 FROM hw_eval_rater_invite i WHERE i.accepted_user_id = r.user_id AND i.status = 'accepted')
       AND NOT EXISTS (SELECT 1 FROM member m WHERE m.user_id = r.user_id)
       AND NOT EXISTS (SELECT 1 FROM student_enrollments e WHERE e.user_id = r.user_id)
       AND coalesce((SELECT u.role FROM "user" u WHERE u.id = r.user_id), 'student') = 'student'
     LIMIT 1`);
  return ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])).length > 0;
}
