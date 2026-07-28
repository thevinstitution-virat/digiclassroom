/**
 * Phase 6: Tenant Isolation Audit Scripts
 * ========================================
 * Run these scripts to verify multi-tenant data isolation is complete and secure.
 *
 * Usage:
 *   npx tsx scripts/audit/tenant-isolation-audit.ts
 *
 * Prerequisites:
 *   - Database must be running and accessible
 *   - At least 2 organizations must exist for cross-tenant testing
 */

import { getPool } from '../../src/lib/db/connection';

interface AuditResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  count?: number;
}

const results: AuditResult[] = [];

// ─── Tables that MUST have organization_id ───────────────────────────────────
const ORG_SCOPED_TABLES = [
  'user_notes', 'user_subscriptions', 'user_progress', 'user_activities',
  'user_streaks', 'user_badges', 'user_quiz_attempts',
  'materials', 'practice_questions', 'quizzes', 'quiz_questions',
  'batches', 'batch_categories', 'batch_subjects', 'batch_enrollments',
  'notices', 'notice_categories',
  'study_plans', 'study_plan_items',
  'ai_messages', 'ai_conversations',
  'exam_categories', 'exam_sub_categories',
  'teacher_verifications',
  'notifications', 'notification_preferences',
  'sarvagya_spaces', 'sarvagya_documents', 'sarvagya_queries',
  'institution_profiles', 'institution_classes', 'institution_sections',
  'student_enrollments'
];

async function main() {
  const pool = getPool();
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Tenant Isolation Audit — DigiClassroomPro MT      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await auditNullOrganizationIds(pool);
  await auditCascadeDeletes(pool);
  await auditRbacBoundaries(pool);
  await auditCrossTenantLeaks(pool);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════ SUMMARY ═══════════════════════');
  const passed = results.filter(r => r.status === 'PASS').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} [${r.status}] ${r.test}: ${r.details}`);
  }

  console.log(`\n  Total: ${results.length} | Passed: ${passed} | Warnings: ${warnings} | Failed: ${failed}`);
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

// ─── TEST 1: NULL organizationId Audit ───────────────────────────────────────
async function auditNullOrganizationIds(pool: any) {
  console.log('\n── Test 1: NULL organizationId Audit ──────────────────');

  for (const table of ORG_SCOPED_TABLES) {
    try {
      const [rows]: any = await pool.query(
        `SELECT COUNT(*) as cnt FROM \`${table}\` WHERE organization_id IS NULL`
      );
      const count = rows[0]?.cnt || 0;

      if (count === 0) {
        results.push({ test: `NULL check: ${table}`, status: 'PASS', details: 'No NULL organization_ids', count });
      } else {
        results.push({ test: `NULL check: ${table}`, status: 'WARN', details: `${count} rows with NULL organization_id`, count });
        console.log(`  ⚠️  ${table}: ${count} rows have NULL organization_id`);
      }
    } catch (err: any) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        results.push({ test: `NULL check: ${table}`, status: 'WARN', details: 'Table does not exist yet' });
      } else if (err.code === 'ER_BAD_FIELD_ERROR') {
        results.push({ test: `NULL check: ${table}`, status: 'FAIL', details: 'Missing organization_id column!' });
        console.log(`  ❌ ${table}: MISSING organization_id column!`);
      } else {
        results.push({ test: `NULL check: ${table}`, status: 'FAIL', details: err.message });
      }
    }
  }
}

// ─── TEST 2: CASCADE Delete Verification ─────────────────────────────────────
async function auditCascadeDeletes(pool: any) {
  console.log('\n── Test 2: CASCADE Delete Verification ────────────────');
  
  for (const table of ORG_SCOPED_TABLES) {
    try {
      const [rows]: any = await pool.query(`
        SELECT CONSTRAINT_NAME, DELETE_RULE 
        FROM information_schema.REFERENTIAL_CONSTRAINTS 
        WHERE TABLE_NAME = ? 
          AND REFERENCED_TABLE_NAME = 'organization'
          AND CONSTRAINT_SCHEMA = DATABASE()
      `, [table]);

      if (rows.length === 0) {
        // Check if this is an institution table (they reference organization differently)
        results.push({ test: `CASCADE: ${table}`, status: 'WARN', details: 'No FK to organization table found' });
      } else {
        const rule = rows[0].DELETE_RULE;
        if (rule === 'CASCADE') {
          results.push({ test: `CASCADE: ${table}`, status: 'PASS', details: 'ON DELETE CASCADE verified' });
        } else {
          results.push({ test: `CASCADE: ${table}`, status: 'FAIL', details: `DELETE_RULE is "${rule}", expected CASCADE` });
          console.log(`  ❌ ${table}: DELETE_RULE is "${rule}", expected CASCADE`);
        }
      }
    } catch (err: any) {
      results.push({ test: `CASCADE: ${table}`, status: 'FAIL', details: err.message });
    }
  }
}

// ─── TEST 3: RBAC Boundary Check ─────────────────────────────────────────────
async function auditRbacBoundaries(pool: any) {
  console.log('\n── Test 3: RBAC Boundary Checks ───────────────────────');

  // Check that every member has a valid role
  try {
    const [rows]: any = await pool.query(`
      SELECT m.id, m.role, m.organization_id, m.user_id
      FROM member m
      WHERE m.role NOT IN ('owner', 'admin', 'org_admin', 'teacher', 'student', 'parent', 'member')
    `);

    if (rows.length === 0) {
      results.push({ test: 'RBAC: Valid member roles', status: 'PASS', details: 'All member roles are recognized' });
    } else {
      results.push({ test: 'RBAC: Valid member roles', status: 'FAIL', details: `${rows.length} members with unrecognized roles` });
      console.log(`  ❌ ${rows.length} members have unrecognized roles`);
    }
  } catch (err: any) {
    results.push({ test: 'RBAC: Valid member roles', status: 'WARN', details: err.message });
  }

  // Check for orphaned members (member without valid user or org)
  try {
    const [rows]: any = await pool.query(`
      SELECT m.id 
      FROM member m 
      LEFT JOIN user u ON m.user_id = u.id
      LEFT JOIN organization o ON m.organization_id = o.id
      WHERE u.id IS NULL OR o.id IS NULL
    `);

    if (rows.length === 0) {
      results.push({ test: 'RBAC: Orphaned members', status: 'PASS', details: 'No orphaned member records' });
    } else {
      results.push({ test: 'RBAC: Orphaned members', status: 'FAIL', details: `${rows.length} orphaned member records` });
      console.log(`  ❌ ${rows.length} orphaned member records (missing user or org)`);
    }
  } catch (err: any) {
    results.push({ test: 'RBAC: Orphaned members', status: 'WARN', details: err.message });
  }
}

// ─── TEST 4: Cross-Tenant Leak Detection ─────────────────────────────────────
async function auditCrossTenantLeaks(pool: any) {
  console.log('\n── Test 4: Cross-Tenant Leak Detection ────────────────');

  // Check student_enrollments → institution_classes belong to the same org
  try {
    const [rows]: any = await pool.query(`
      SELECT se.id as enrollment_id, se.organization_id as enrollment_org, ic.organization_id as class_org
      FROM student_enrollments se
      JOIN institution_classes ic ON se.class_id = ic.id
      WHERE se.organization_id != ic.organization_id
    `);

    if (rows.length === 0) {
      results.push({ test: 'Leak: enrollments ↔ classes', status: 'PASS', details: 'All enrollments reference same-org classes' });
    } else {
      results.push({ test: 'Leak: enrollments ↔ classes', status: 'FAIL', details: `${rows.length} cross-org enrollment-class references!` });
      console.log(`  ❌ ${rows.length} enrollments referencing classes from a different org!`);
    }
  } catch (err: any) {
    results.push({ test: 'Leak: enrollments ↔ classes', status: 'WARN', details: `Skipped: ${err.message}` });
  }

  // Check institution_sections → institution_classes belong to the same org
  try {
    const [rows]: any = await pool.query(`
      SELECT s.id as section_id, s.organization_id as section_org, c.organization_id as class_org
      FROM institution_sections s
      JOIN institution_classes c ON s.class_id = c.id
      WHERE s.organization_id != c.organization_id
    `);

    if (rows.length === 0) {
      results.push({ test: 'Leak: sections ↔ classes', status: 'PASS', details: 'All sections reference same-org classes' });
    } else {
      results.push({ test: 'Leak: sections ↔ classes', status: 'FAIL', details: `${rows.length} cross-org section-class references!` });
      console.log(`  ❌ ${rows.length} sections referencing classes from a different org!`);
    }
  } catch (err: any) {
    results.push({ test: 'Leak: sections ↔ classes', status: 'WARN', details: `Skipped: ${err.message}` });
  }

  // Generic check: look for any data table where a user's org membership doesn't match the data's org
  try {
    const [rows]: any = await pool.query(`
      SELECT 'user_notes' as tbl, COUNT(*) as cnt FROM user_notes un
      LEFT JOIN member m ON un.user_id = m.user_id AND un.organization_id = m.organization_id
      WHERE un.organization_id IS NOT NULL AND m.id IS NULL
      UNION ALL
      SELECT 'materials' as tbl, COUNT(*) as cnt FROM materials mat
      LEFT JOIN member m ON mat.uploaded_by = m.user_id AND mat.organization_id = m.organization_id
      WHERE mat.organization_id IS NOT NULL AND m.id IS NULL
    `);

    for (const row of rows) {
      if (row.cnt === 0) {
        results.push({ test: `Leak: ${row.tbl} user-org mismatch`, status: 'PASS', details: 'All records belong to member orgs' });
      } else {
        results.push({ test: `Leak: ${row.tbl} user-org mismatch`, status: 'WARN', details: `${row.cnt} records where user is not a member of the record's org` });
      }
    }
  } catch (err: any) {
    results.push({ test: 'Leak: user-org mismatch', status: 'WARN', details: `Skipped: ${err.message}` });
  }
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
