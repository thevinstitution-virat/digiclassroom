// scripts/practest/migrate-schema-upgrades.ts
//
// Idempotent, additive Practest schema upgrades. Safe to run multiple times.
// It ONLY adds (never drops) — your existing data and queries keep working.
//
//   1. practest_question_bank.options  (JSON)        — canonical shuffle-safe option
//      model: [{ id, text, isCorrect, imageUrl? }]. Enables >4 options, multi-select,
//      per-option media. The app already derives this from option_a..d at read time;
//      this column lets you STORE it natively. Backfilled from the legacy columns.
//   2. practest_question_bank.language (VARCHAR)      — medium (English/Hindi/…), the
//      "E" in your QID model.
//   3. curriculum_nodes (TABLE)                       — canonical taxonomy (board → class
//      → subject → chapter → topic) so questions reference real nodes instead of
//      free-text strings (kills "Social Science" vs "SST" fragmentation).
//
// Run:  npx tsx --env-file=.env --env-file=.env.local scripts/practest/migrate-schema-upgrades.ts
//
// AFTER running, add `options` + `language` to the Drizzle schema (src/db/schema.ts)
// and flip lib/practest/options.ts to prefer the `options` column (it already does
// when present). curriculum_nodes can then back an admin taxonomy manager.

import { executeQuery, executeUpdate, closePool } from '../../src/lib/db/connection'

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await executeQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  )
  return Number(rows[0]?.n ?? 0) > 0
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await executeQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  )
  return Number(rows[0]?.n ?? 0) > 0
}

async function main() {
  console.log('▶ Practest schema upgrades (additive, idempotent)\n')

  // 1. options JSON column
  if (!(await columnExists('practest_question_bank', 'options'))) {
    await executeUpdate(`ALTER TABLE practest_question_bank ADD COLUMN options JSON NULL AFTER option_d`)
    console.log('✅ added practest_question_bank.options')
  } else {
    console.log('• practest_question_bank.options already exists')
  }

  // 1b. backfill options from legacy A–D + correct_option where null
  const backfill = await executeUpdate(
    `UPDATE practest_question_bank
       SET options = JSON_ARRAY(
         JSON_OBJECT('id','o1','text',option_a,'isCorrect', correct_option='A'),
         JSON_OBJECT('id','o2','text',option_b,'isCorrect', correct_option='B'),
         JSON_OBJECT('id','o3','text',option_c,'isCorrect', correct_option='C'),
         JSON_OBJECT('id','o4','text',option_d,'isCorrect', correct_option='D')
       )
     WHERE options IS NULL AND option_a IS NOT NULL`,
  )
  console.log(`✅ backfilled options on ${backfill.affectedRows} row(s)`)

  // 2. language column
  if (!(await columnExists('practest_question_bank', 'language'))) {
    await executeUpdate(`ALTER TABLE practest_question_bank ADD COLUMN language VARCHAR(50) NULL AFTER board`)
    console.log('✅ added practest_question_bank.language')
  } else {
    console.log('• practest_question_bank.language already exists')
  }

  // 3. curriculum_nodes table
  if (!(await tableExists('curriculum_nodes'))) {
    await executeUpdate(`
      CREATE TABLE curriculum_nodes (
        id            VARCHAR(36)  NOT NULL PRIMARY KEY,
        organization_id VARCHAR(255) NULL,
        board         VARCHAR(50)  NOT NULL,
        language      VARCHAR(50)  NULL,
        class_level   INT          NOT NULL,
        subject       VARCHAR(120) NOT NULL,
        chapter       VARCHAR(255) NULL,
        chapter_order INT          NULL,
        topic         VARCHAR(255) NULL,
        topic_order   INT          NULL,
        subtopic      VARCHAR(255) NULL,
        ncert_reference VARCHAR(255) NULL,
        is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_curr_node (board, class_level, subject, chapter, topic, subtopic),
        KEY idx_curr_scope (board, class_level, subject)
      )
    `)
    console.log('✅ created curriculum_nodes')
  } else {
    console.log('• curriculum_nodes already exists')
  }

  console.log('\n✔ Done.')
  await closePool()
}

main().catch(async (e) => {
  console.error('❌ Migration failed:', e)
  try { await closePool() } catch {}
  process.exit(1)
})
