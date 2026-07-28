// scripts/set-super-admin.ts
// One-time script: elevates the platform owner's existing account to super_admin.
//
// Why needed:
//   databaseHooks.user.create.before only fires at signup.
//   The existing owner account was created before Phase 1, so the hook
//   never ran for them. This script backfills the role.
//
// Usage:
//   npx tsx scripts/set-super-admin.ts
//
// Requires:
//   SUPER_ADMIN_EMAIL=<owner-email> in .env (or environment)
//   DATABASE_URL set in .env
//
// Safe to re-run — idempotent.

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { user as userTable } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  if (!superAdminEmail) {
    console.error('❌  SUPER_ADMIN_EMAIL is not set in environment.');
    console.error('    Add it to .env and retry.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌  DATABASE_URL is not set in environment.');
    process.exit(1);
  }

  console.log(`🔍  Looking up user: ${superAdminEmail}`);

  const connection = await mysql.createConnection(databaseUrl);
  const db = drizzle(connection);

  try {
    // 1. Find the user
    const users = await db
      .select({ id: userTable.id, email: userTable.email, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.email, superAdminEmail))
      .limit(1);

    if (users.length === 0) {
      console.error(`❌  No user found with email: ${superAdminEmail}`);
      console.error('    Ensure the account exists before running this script.');
      process.exit(1);
    }

    const existing = users[0];

    if (existing.role === 'super_admin') {
      console.log(`✅  User ${superAdminEmail} is already super_admin. Nothing to do.`);
      process.exit(0);
    }

    console.log(`📋  Current role: ${existing.role}`);
    console.log(`🔄  Elevating to: super_admin`);

    // 2. Update the role
    await db
      .update(userTable)
      .set({ role: 'super_admin', updatedAt: new Date() })
      .where(eq(userTable.id, existing.id));

    console.log(`✅  Done. ${superAdminEmail} is now super_admin.`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Sign out and sign back in to get a fresh session token.');
    console.log('  2. Verify: GET /api/me should return { globalRole: "super_admin", dashboard: "/dashboard/admin" }');

  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('❌  Script failed:', err);
  process.exit(1);
});
