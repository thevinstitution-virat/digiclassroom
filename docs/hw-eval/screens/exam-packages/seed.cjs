// Seeds the SCRATCH database (localhost:55436) for a look at the exam-package builder: one super admin. Test credentials only (the same
// throwaway password as the phase 3-5 walkthrough seed); nothing here touches a real service. The board paper for the pickers is published
// by seed-paper.test.ts (run with jest, see README.md).
const { createRequire } = require('module');
const req = createRequire('H:/Trio/worktrees/DCP-hw-wt/package.json');
const { Client } = req('pg');
const { hashPassword } = req('better-auth/crypto');

const PASSWORD = 'Walkthrough#2026';
const SA = 'wt-sa';

(async () => {
  const c = new Client({ connectionString: 'postgres://postgres:scratch@localhost:55436/digiclassroom' });
  await c.connect();
  const q = (sql, p) => c.query(sql, p);
  await q('ALTER TABLE "user" DISABLE TRIGGER trg_protect_super_admin'); // scratch database only
  try {
    await q(`DELETE FROM "user" WHERE id = $1`, [SA]);
    await q(`INSERT INTO "user" (id, name, email, email_verified, role) VALUES ($1, 'Super Admin', $2, true, 'super_admin')`, [SA, `${SA}@walkthrough.test`]);
    await q(`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES ($1, $2, 'credential', $3, $4, now(), now())`, [`acc-${SA}`, SA, SA, await hashPassword(PASSWORD)]);
  } finally {
    await q('ALTER TABLE "user" ENABLE TRIGGER trg_protect_super_admin');
  }
  console.log(`super admin: ${SA}@walkthrough.test`);
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
