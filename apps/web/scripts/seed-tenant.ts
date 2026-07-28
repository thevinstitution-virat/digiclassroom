#!/usr/bin/env npx tsx
/**
 * seed-tenant.ts — Seed the default tenant and admin user (M1 fix).
 *
 * Prerequisites:
 *   1. PostgreSQL must be running (`docker compose up -d postgres`)
 *   2. DATABASE_URL must be set
 *   3. Drizzle migrations must have been applied
 *
 * Usage:
 *   npx tsx scripts/seed-tenant.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Export it before running this script.');
  process.exit(1);
}

const connection = postgres(DATABASE_URL);
const db = drizzle(connection);

// ---------------------------------------------------------------------------
// Configuration — edit these for your deployment
// ---------------------------------------------------------------------------
const DEFAULT_TENANT = {
  name: 'DigiClassroom Default',
  domain: 'digiclassroom.local',
  subscriptionPlan: 'starter',
  subscriptionStatus: 'active',
};

const ADMIN_USER = {
  email: 'thevinstitution@gmail.com',
  role: 'admin',
  firstName: 'Admin',
  lastName: 'User',
};

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------
async function seed() {
  console.log('🌱 Seeding default tenant and admin user...\n');

  // 1. Upsert default tenant
  const tenantResult = await db.execute(sql`
    INSERT INTO tenants (name, domain, subscription_plan, subscription_status)
    VALUES (${DEFAULT_TENANT.name}, ${DEFAULT_TENANT.domain}, ${DEFAULT_TENANT.subscriptionPlan}, ${DEFAULT_TENANT.subscriptionStatus})
    ON CONFLICT (domain) DO UPDATE SET
      name = EXCLUDED.name,
      subscription_plan = EXCLUDED.subscription_plan,
      subscription_status = EXCLUDED.subscription_status,
      updated_at = NOW()
    RETURNING id, name, domain
  `);

  const tenant = tenantResult[0] as { id: string; name: string; domain: string };
  console.log(`✅ Tenant seeded: "${tenant.name}" (${tenant.id})`);

  // 2. Upsert admin user linked to tenant
  let userResult = await db.execute(sql`
      SELECT id, email, role FROM users WHERE email = ${ADMIN_USER.email} LIMIT 1
    `);

  let user: { id: string; email: string; role: string };

  if (userResult.length > 0) {
    user = userResult[0] as { id: string; email: string; role: string };
    await db.execute(sql`
        UPDATE users SET
          tenant_id = ${tenant.id},
          role = ${ADMIN_USER.role},
          first_name = ${ADMIN_USER.firstName},
          last_name = ${ADMIN_USER.lastName},
          updated_at = NOW()
        WHERE id = ${user.id}
      `);
  } else {
    const insertResult = await db.execute(sql`
        INSERT INTO users (tenant_id, email, role, first_name, last_name, approval_status, verification_status)
        VALUES (${tenant.id}, ${ADMIN_USER.email}, ${ADMIN_USER.role}, ${ADMIN_USER.firstName}, ${ADMIN_USER.lastName}, 'approved', 'verified_email')
        RETURNING id, email, role
      `);
    user = insertResult[0] as { id: string; email: string; role: string };
  }
  console.log(`✅ Admin user seeded: "${user.email}" (${user.id}) — role: ${user.role}`);

  // 3. Seed default Better Auth organization (if org plugin tables exist)
  try {
    await db.execute(sql`
      INSERT INTO organization (id, name, slug, created_at, metadata)
      VALUES (${tenant.id}, ${DEFAULT_TENANT.name}, 'default', NOW(), '{}')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log(`✅ Better Auth organization seeded (id: ${tenant.id})`);
  } catch (e) {
    console.log('⚠️  Better Auth organization table not found — skipping (run better-auth generate first)');
  }

  // 4. Seed default user profile
  try {
    await db.execute(sql`
      INSERT INTO user_profiles (user_id, role, board_type, medium, grade_level, is_onboarding_complete)
      VALUES (${user.id}, 'admin', 'CBSE', 'ENGLISH', 12, true)
      ON CONFLICT (user_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_onboarding_complete = true,
        updated_at = NOW()
    `);
    console.log(`✅ Admin profile seeded`);
  } catch (e) {
    console.log('⚠️  user_profiles table not found — skipping');
  }

  console.log('\n🎉 Seed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await connection.end();
  });
