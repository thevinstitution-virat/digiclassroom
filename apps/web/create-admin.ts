import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { auth } from './src/auth/index';
import { getPool, closePool } from './src/lib/db/connection';

async function main() {
  const email = 'thevinstitution@gmail.com';
  const password = 'Virat@2050.vpdmns';
  const name = 'The V Institution';

  console.log(`\nCreating super-admin user: ${email}`);

  try {
    // BetterAuth signUpEmail handles password hashing and database hooks.
    // The databaseHook in src/auth/index.ts will automatically assign role='admin'
    // when it detects this specific email address.
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name
      }
    });

    console.log(`\n✅ Account created successfully!`);
    console.log(`   ID: ${res.user.id}`);
    console.log(`   Email: ${res.user.email}`);
    console.log(`   Database Role: ${res.user.role}`);
    console.log(`   (You can now login with these credentials)`);

  } catch (err: any) {
    console.error(`\n❌ Failed to create user:`, err);
    // Check if the error is just that the user already exists
    if (err?.message?.includes('already exists')) {
       console.log('   (User might already exist. You can try logging in normally.)');
    }
  }

  // Close the DB pool so the script exits cleanly
  await closePool();
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
