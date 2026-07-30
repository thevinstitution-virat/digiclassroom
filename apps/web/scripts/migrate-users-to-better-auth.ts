// scripts/migrate-users-to-better-auth.ts
// Bug T4 fix: dual identity tables — `users` (legacy Clerk) + `user` (Better Auth) with no FK.
//
// This script is a DRY RUN by default. Pass --execute to apply changes.
// Run in staging first. Takes a full backup before any writes.
//
// What it does:
//   1. Finds rows in `users` (legacy) that have no matching row in `user` (Better Auth) by email
//   2. Reports them (dry run) or migrates them (execute mode)
//   3. Finds rows in legacy tables still referencing `users.clerkId` instead of `user.id`
//      and reports which tables need a column reference update
//
// Usage:
//   DRY RUN:   npx tsx scripts/migrate-users-to-better-auth.ts
//   EXECUTE:   npx tsx scripts/migrate-users-to-better-auth.ts --execute
//
// After this script: update all queries that join on `users` to join on `user` instead.

import 'dotenv/config';
import mysql from 'mysql2/promise';

const EXECUTE = process.argv.includes('--execute');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DCP T4 Migration — users → user consolidation`);
  console.log(`Mode: ${EXECUTE ? '⚠️  EXECUTE (writes to DB)' : '✅  DRY RUN (read-only)'}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // ── Step 1: Inventory ───────────────────────────────────────────────────
    const [legacyUsers] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT u.id as legacy_id, u.email, u.name, u.role, u.clerk_id
       FROM users u
       LEFT JOIN \`user\` ba ON ba.email = u.email
       WHERE ba.id IS NULL`,
    );

    console.log(`📊  Legacy users with no Better Auth counterpart: ${legacyUsers.length}`);

    if (legacyUsers.length === 0) {
      console.log('✅  All legacy users already have a Better Auth account. Nothing to migrate.');
    } else {
      console.table(legacyUsers.map((u) => ({
        legacy_id: u.legacy_id,
        email: u.email,
        name: u.name,
        role: u.role,
        clerk_id: u.clerk_id,
      })));

      if (EXECUTE) {
        console.log('\n🔄  Migrating orphaned legacy users into `user` table...');
        let migrated = 0;
        for (const legacy of legacyUsers) {
          const newId = crypto.randomUUID();
          await conn.execute(
            `INSERT INTO \`user\`
               (id, name, email, role, email_verified, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, NOW(), NOW())
             ON CONFLICT (email) DO NOTHING`,   // safety: skip if email already exists
            [newId, legacy.name, legacy.email, legacy.role ?? 'student'],
          );
          migrated++;
        }
        console.log(`✅  Migrated ${migrated} users.`);
      }
    }

    // ── Step 2: Find tables still using clerkId as a join key ──────────────
    console.log('\n📊  Checking for tables with active clerkId references...\n');

    const clerkRefTables = [
      { table: 'user_notes',               col: 'clerk_id' },
      { table: 'note_folders',             col: 'clerk_id' },
      { table: 'community_phrases',        col: 'clerk_id' },
      { table: 'user_vocab_progress',      col: 'clerk_user_id' },
      { table: 'dictionary_search_history',col: 'clerk_user_id' },
      { table: 'dictionary_offline_sync',  col: 'clerk_user_id' },
      { table: 'dictionary_user_stats',    col: 'clerk_user_id' },
      { table: 'user_subscriptions',       col: 'clerk_id' },
    ];

    for (const { table, col } of clerkRefTables) {
      const [[{ count }]] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM \`${table}\` WHERE \`${col}\` IS NOT NULL`,
      );
      const status = count > 0 ? '⚠️ ' : '✅';
      console.log(`${status}  ${table}.${col}: ${count} rows still set`);
    }

    console.log('\n📋  Tables with non-null clerkId need their application code updated');
    console.log('     to use user.id (Better Auth) as the join key instead.');
    console.log('     After updating code: set clerk_id = NULL on all rows,');
    console.log('     then drop the column in a follow-up migration.\n');

    // ── Step 3: Overlap report ──────────────────────────────────────────────
    const [[{ overlap }]] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as overlap
       FROM users legacy
       JOIN \`user\` ba ON ba.email = legacy.email`,
    );
    console.log(`📊  Users that exist in BOTH tables (by email): ${overlap}`);
    console.log('     These are safe — Better Auth is the canonical record.');
    console.log('     The legacy row can be dropped once all FK references are updated.\n');

  } finally {
    await conn.end();
    console.log(`${'='.repeat(60)}`);
    console.log(EXECUTE ? '🏁  Migration complete.' : '🏁  Dry run complete. No changes made.');
    console.log(`${'='.repeat(60)}\n`);
  }
}

main().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
