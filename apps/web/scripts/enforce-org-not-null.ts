/**
 * Phase 1 (Final): Enforce NOT NULL on organization_id
 * =====================================================
 * 
 * This script runs AFTER the backfill migration has populated organization_id
 * on all existing rows. It performs a safety audit first, then applies
 * NOT NULL constraints to every org-scoped table.
 * 
 * Usage:
 *   npx tsx scripts/enforce-org-not-null.ts [--dry-run] [--force]
 *
 * Flags:
 *   --dry-run   Only audit, don't apply changes (default)
 *   --force     Actually apply NOT NULL constraints
 *
 * ⚠️  WARNING: This is a destructive migration. Run with --dry-run first!
 */

import { getPool, closePool } from '../src/lib/db/connection';

// All tables that have a nullable organization_id column and need NOT NULL enforcement
const ORG_SCOPED_TABLES = [
  'enhanced_user_profiles',
  'subscription_plans',
  'user_subscriptions',
  'materials',
  'practice_questions',
  'user_notes',
  'user_progress',
  'user_activities',
  'user_streaks',
  'user_badges',
  'user_quiz_attempts',
  'study_plans',
  'study_plan_items',
  'batches',
  'batch_categories',
  'batch_subjects',
  'batch_enrollments',
  'notices',
  'notice_categories',
  'ai_messages',
  'ai_conversations',
  'quizzes',
  'quiz_questions',
  'exam_categories',
  'exam_sub_categories',
  'teacher_verifications',
  'notifications',
  'notification_preferences',
  'sarvagya_spaces',
  'sarvagya_documents',
  'sarvagya_queries',
  'institution_profiles',
  'institution_classes',
  'institution_sections',
  'student_enrollments',
];

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--force');
  const pool = getPool();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Enforce NOT NULL on organization_id                ║');
  console.log(`║  Mode: ${isDryRun ? 'DRY RUN (use --force to apply)' : '⚠️  LIVE — APPLYING CHANGES'}${''.padEnd(isDryRun ? 7 : 3)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── Step 1: Pre-flight audit ──────────────────────────────────────────────
  console.log('── Step 1: Pre-flight Audit ──────────────────────────\n');
  
  let hasNulls = false;
  const tableResults: { table: string; nullCount: number; totalCount: number; exists: boolean }[] = [];

  for (const table of ORG_SCOPED_TABLES) {
    try {
      const [rows]: any = await pool.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN organization_id IS NULL THEN 1 ELSE 0 END) as nulls
        FROM \`${table}\``
      );
      
      const total = rows[0]?.total || 0;
      const nulls = rows[0]?.nulls || 0;
      
      tableResults.push({ table, nullCount: nulls, totalCount: total, exists: true });
      
      if (nulls > 0) {
        hasNulls = true;
        console.log(`  ❌ ${table}: ${nulls}/${total} rows have NULL organization_id`);
      } else {
        console.log(`  ✅ ${table}: ${total} rows — all have organization_id`);
      }
    } catch (err: any) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        tableResults.push({ table, nullCount: 0, totalCount: 0, exists: false });
        console.log(`  ⏭️  ${table}: table does not exist yet, skipping`);
      } else if (err.code === 'ER_BAD_FIELD_ERROR') {
        tableResults.push({ table, nullCount: -1, totalCount: 0, exists: true });
        console.log(`  ⚠️  ${table}: missing organization_id column!`);
      } else {
        console.log(`  ⚠️  ${table}: ${err.message}`);
        tableResults.push({ table, nullCount: -1, totalCount: 0, exists: true });
      }
    }
  }

  // ── Step 2: Block if NULLs exist ──────────────────────────────────────────
  if (hasNulls) {
    console.log('\n🛑 BLOCKED: Some tables still have NULL organization_id values.');
    console.log('   Run the backfill migration first: npx tsx scripts/migrate-tenant-data.ts');
    console.log('   Or manually assign orphaned rows to a default organization.\n');
    await closePool();
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\n✅ Audit passed! All rows have organization_id populated.');
    console.log('   Run with --force to apply NOT NULL constraints.\n');
    await closePool();
    process.exit(0);
  }

  // ── Step 3: Apply NOT NULL constraints ────────────────────────────────────
  console.log('\n── Step 3: Applying NOT NULL Constraints ──────────────\n');

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const { table, exists, nullCount } of tableResults) {
    if (!exists || nullCount === -1) {
      skipped++;
      continue;
    }

    try {
      // First, get the current column definition to preserve type and FK
      const [cols]: any = await pool.query(
        `SELECT COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = 'organization_id'`,
        [table]
      );

      if (cols.length === 0) {
        console.log(`  ⏭️  ${table}: no organization_id column found, skipping`);
        skipped++;
        continue;
      }

      if (cols[0].IS_NULLABLE === 'NO') {
        console.log(`  ⏭️  ${table}: already NOT NULL, skipping`);
        skipped++;
        continue;
      }

      // Apply NOT NULL — preserve the varchar type
      await pool.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`organization_id\` VARCHAR(255) NOT NULL`
      );

      console.log(`  ✅ ${table}: NOT NULL constraint applied`);
      applied++;
    } catch (err: any) {
      console.log(`  ❌ ${table}: FAILED — ${err.message}`);
      failed++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════ SUMMARY ═══════════════════════');
  console.log(`  Applied: ${applied}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed:  ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('⚠️  Some tables failed. Review errors above and fix manually.\n');
  } else {
    console.log('🎉 All NOT NULL constraints applied successfully!\n');
  }

  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
