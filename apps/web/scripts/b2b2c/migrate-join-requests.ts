// scripts/b2b2c/migrate-join-requests.ts
// Idempotent: creates institution_join_requests if missing.
// Run: npx tsx --env-file=.env --env-file=.env.local scripts/b2b2c/migrate-join-requests.ts

import { executeQuery, executeUpdate, closePool } from '../../src/lib/db/connection'

async function tableExists(name: string): Promise<boolean> {
  const rows = await executeQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [name],
  )
  return Number(rows[0]?.n ?? 0) > 0
}

async function main() {
  if (await tableExists('institution_join_requests')) {
    console.log('• institution_join_requests already exists')
    return
  }
  await executeUpdate(`
    CREATE TABLE institution_join_requests (
      id              VARCHAR(36)  NOT NULL PRIMARY KEY,
      user_id         VARCHAR(255) NOT NULL,
      organization_id VARCHAR(255) NOT NULL,
      status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
      message         TEXT         NULL,
      requested_class INT          NULL,
      requested_board VARCHAR(50)  NULL,
      reviewed_by     VARCHAR(255) NULL,
      reviewed_at     TIMESTAMP    NULL,
      created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY ijr_org_idx (organization_id),
      KEY ijr_user_idx (user_id),
      KEY ijr_status_idx (status)
    )
  `)
  console.log('✅ created institution_join_requests')
}

main()
  .then(async () => { await closePool().catch(() => {}); process.exit(0) })
  .catch(async (e) => { console.error('❌ Migration failed:', e); await closePool().catch(() => {}); process.exit(1) })
