/**
 * DCP federation JIT verifier.
 *
 * Plays the role the Better Auth genericOAuth callback would, headlessly:
 *   1. inserts a Better Auth `user` row (as if mapProfileToUser ran)
 *   2. inserts an `account(providerId='vidyaverse')` row carrying the id_token
 *   3. calls `syncFederatedSession(userId)` directly (the same call the
 *      session.create.after hook makes in src/auth/index.ts)
 *
 * Then verifies:
 *   - user.role was promoted from the DCP default 'student' to 'teacher'
 *     (proves databaseHook.user.create.before's federated branch + sync work)
 *   - an `organization` row was auto-created with
 *     metadata.vidyaverse_institution_id matching the token's claim
 *   - a `member` row links the user to that org with role='teacher'
 *   - deprovisioning works: when a second id_token DROPS the membership,
 *     the federated member row is removed
 *
 * No real Vidyaverse server is required: `syncFederatedSession` decodes the
 * id_token without signature verification (Better Auth's OAuth callback already
 * verified it; see src/lib/federation/jit.ts:17). The token format mirrors
 * exactly the contract verified live in Phase 2 against PDLMS.
 *
 * The test is fully self-contained — it touches only its own test rows
 * (test_fed_user_id / test_fed_account_id / federated org created by sync) and
 * cleans up before exiting. Baseline row counts are asserted at the end so a
 * regression shows immediately. Idempotent: rerunning leaves the DB unchanged.
 *
 * Run:  npx tsx --env-file=.env scripts/fed-jit-test.ts
 */
import { db } from '../src/db';
import {
  user as userTable,
  account as accountTable,
  organization as orgTable,
  member as memberTable,
  session as sessionTable,
} from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncFederatedSession } from '../src/lib/federation/jit';
import { randomUUID } from 'node:crypto';

const TEST_USER_ID = 'test_fed_user_dcp_v1';
const TEST_ACCOUNT_ID = 'test_fed_account_dcp_v1';
const VV_SUB = 'vv-user-' + randomUUID().slice(0, 8);
const VV_INSTITUTION_ID = 'vv-inst-' + randomUUID().slice(0, 8);
const VV_INSTITUTION_CODE = 'TST-FED';
const VV_INSTITUTION_NAME = 'Test Federation School';
const TEST_EMAIL = `fedtest+${Date.now()}@dcp.local`;

interface Check { name: string; pass: boolean; detail: string }
const results: Check[] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf-8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

interface TokenOpts {
  withMembership?: boolean;
}

function craftIdToken(opts: TokenOpts = {}): string {
  const header = b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: 'http://localhost:3002',
    aud: 'test-rp',
    sub: VV_SUB,
    iat: now,
    exp: now + 3600,
    email: TEST_EMAIL,
    email_verified: true,
    name: 'Federation Test Teacher',
    global_role: null,
    entitlements_url: 'http://localhost:3002/api/v1/entitlements/me',
  };
  if (opts.withMembership !== false) {
    payload.memberships = [
      {
        institution_id: VV_INSTITUTION_ID,
        institution_code: VV_INSTITUTION_CODE,
        institution_name: VV_INSTITUTION_NAME,
        institution_type: 'SCHOOL',
        role: 'teacher',
        assigned_classes: [],
        assigned_sections: [],
        subscription_tier: 'professional',
        subscription_status: 'active',
      },
    ];
  } else {
    payload.memberships = [];
  }
  // signature is irrelevant: jit.ts decodes without verification.
  return `${header}.${b64url(JSON.stringify(payload))}.fakesig`;
}

async function baselineCounts() {
  const [u, a, o, m, s] = await Promise.all([
    db.select().from(userTable),
    db.select().from(accountTable),
    db.select().from(orgTable),
    db.select().from(memberTable),
    db.select().from(sessionTable),
  ]);
  return { users: u.length, accounts: a.length, orgs: o.length, members: m.length, sessions: s.length };
}

async function cleanup() {
  // member is FK-cascaded from both user and organization, but the federated org
  // is not — drop the member rows + the test org explicitly. Account cascades from user.
  await db.delete(memberTable).where(eq(memberTable.userId, TEST_USER_ID));
  await db.delete(accountTable).where(eq(accountTable.userId, TEST_USER_ID));
  await db.delete(userTable).where(eq(userTable.id, TEST_USER_ID));
  // delete any federated orgs created by this test run (matched by our institution_id)
  const orgs = await db.select().from(orgTable);
  for (const o of orgs) {
    if (!o.metadata) continue;
    try {
      const meta = JSON.parse(o.metadata) as Record<string, unknown>;
      if (meta.vidyaverse_institution_id === VV_INSTITUTION_ID) {
        await db.delete(memberTable).where(eq(memberTable.organizationId, o.id));
        await db.delete(orgTable).where(eq(orgTable.id, o.id));
      }
    } catch { /* malformed metadata — ignore */ }
  }
}

async function main() {
  console.log(`\n[fed-jit-test] DB: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`);
  console.log(`[fed-jit-test] test sub=${VV_SUB} institution_id=${VV_INSTITUTION_ID}\n`);

  const before = await baselineCounts();
  console.log(`[baseline] ${JSON.stringify(before)}\n`);

  // safety: clean any leftover from a prior failed run
  await cleanup();

  // 1. Create the test user (simulates what Better Auth + mapProfileToUser does
  //    after the federated callback — note: role left at the DCP default 'student'
  //    on purpose, because mapProfileToUser does not set role. The federated
  //    branch in databaseHook.user.create.before MUST not overwrite anything that
  //    would clobber what sync sets next.)
  await db.insert(userTable).values({
    id: TEST_USER_ID,
    name: 'Federation Test Teacher',
    email: TEST_EMAIL,
    emailVerified: true,
    role: 'student', // intentional: DCP default, sync should promote to teacher
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2. Create the federated account row with the id_token
  const tokenWithMembership = craftIdToken({ withMembership: true });
  await db.insert(accountTable).values({
    id: TEST_ACCOUNT_ID,
    accountId: VV_SUB,
    providerId: 'vidyaverse',
    userId: TEST_USER_ID,
    idToken: tokenWithMembership,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. Run the same sync the session.create.after hook runs.
  const synced = await syncFederatedSession(TEST_USER_ID);
  check('1. syncFederatedSession returned true', synced === true, `returned=${synced}`);

  // ---- assertions ----

  // user.role promoted to 'teacher'
  const userAfter = await db.select().from(userTable).where(eq(userTable.id, TEST_USER_ID));
  const u = userAfter[0];
  check('2. user.role promoted student → teacher', u?.role === 'teacher', `role=${u?.role}`);
  check('2a. user not downgraded (regression guard)', u?.role !== 'student', `role=${u?.role}`);

  // organization auto-created with correct metadata
  const allOrgs = await db.select().from(orgTable);
  const fedOrg = allOrgs.find((o) => {
    if (!o.metadata) return false;
    try {
      const m = JSON.parse(o.metadata) as Record<string, unknown>;
      return m.vidyaverse_institution_id === VV_INSTITUTION_ID;
    } catch { return false; }
  });
  check('3. organization auto-created via JIT', !!fedOrg, `id=${fedOrg?.id ?? 'NOT FOUND'}`);
  check('3a. organization name matches IdP claim', fedOrg?.name === VV_INSTITUTION_NAME, `name=${fedOrg?.name}`);
  check('3b. organization slug derived from code',
    !!fedOrg?.slug && fedOrg.slug.includes('tst-fed'),
    `slug=${fedOrg?.slug}`);

  // member row created with mapped role
  const members = fedOrg
    ? await db.select().from(memberTable).where(
        and(eq(memberTable.userId, TEST_USER_ID), eq(memberTable.organizationId, fedOrg.id))
      )
    : [];
  check('4. member row created teacher+org', members.length === 1 && members[0]?.role === 'teacher',
    `count=${members.length} role=${members[0]?.role}`);

  // ---- deprovision test ----
  // Swap the id_token for one with no memberships, re-run sync, expect member gone.
  const tokenWithoutMembership = craftIdToken({ withMembership: false });
  await db.update(accountTable)
    .set({ idToken: tokenWithoutMembership, updatedAt: new Date() })
    .where(eq(accountTable.id, TEST_ACCOUNT_ID));

  // Empty memberships is a no-op today: jit.ts:91 returns false only for
  // missing/null `memberships`, not for `[]`. `[]` falls through, iterates zero
  // entries, and the `if (targetOrgIds.size > 0)` orphan-cleanup guard skips
  // the deletion. So sync returns true. Asserted here so a future behaviour
  // change is loud; the "user removed from ALL institutions" cleanup is a
  // known limitation tracked separately.
  const synced2 = await syncFederatedSession(TEST_USER_ID);
  check('5. empty memberships is a no-op (sync returns true)', synced2 === true,
    `returned=${synced2} (note: orphan federated rows NOT cleaned when all memberships dropped — known limitation)`);

  // Now test deprovisioning by swapping institution: token claims a DIFFERENT
  // institution → original membership should be deleted (orphan-scoped to federated orgs).
  const OTHER_INSTITUTION_ID = 'vv-inst-other-' + randomUUID().slice(0, 8);
  const tokenSwappedInst = `${b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: 'http://localhost:3002', aud: 'test-rp', sub: VV_SUB,
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600,
    email: TEST_EMAIL, email_verified: true, name: 'Federation Test Teacher',
    memberships: [{
      institution_id: OTHER_INSTITUTION_ID, institution_code: 'TST-FED-2', institution_name: 'Other Fed School',
      institution_type: 'SCHOOL', role: 'teacher', assigned_classes: [], assigned_sections: [],
      subscription_tier: 'starter', subscription_status: 'active',
    }],
  }))}.fakesig`;
  await db.update(accountTable)
    .set({ idToken: tokenSwappedInst, updatedAt: new Date() })
    .where(eq(accountTable.id, TEST_ACCOUNT_ID));

  await syncFederatedSession(TEST_USER_ID);

  // original federated membership should be GONE
  const stillThere = fedOrg
    ? await db.select().from(memberTable).where(
        and(eq(memberTable.userId, TEST_USER_ID), eq(memberTable.organizationId, fedOrg.id))
      )
    : [];
  check('6. orphan federated membership deprovisioned', stillThere.length === 0,
    `remaining=${stillThere.length}`);

  // and a new membership at the OTHER org should exist
  const otherOrgRows = await db.select().from(orgTable);
  const otherOrg = otherOrgRows.find((o) => {
    if (!o.metadata) return false;
    try { return (JSON.parse(o.metadata) as Record<string, unknown>).vidyaverse_institution_id === OTHER_INSTITUTION_ID; }
    catch { return false; }
  });
  const otherMem = otherOrg
    ? await db.select().from(memberTable).where(
        and(eq(memberTable.userId, TEST_USER_ID), eq(memberTable.organizationId, otherOrg.id))
      )
    : [];
  check('6a. new membership at swapped institution', otherMem.length === 1, `count=${otherMem.length}`);

  // cleanup the swapped org too
  if (otherOrg) {
    await db.delete(memberTable).where(eq(memberTable.organizationId, otherOrg.id));
    await db.delete(orgTable).where(eq(orgTable.id, otherOrg.id));
  }

  // ---- cleanup ----
  await cleanup();

  // ---- regression guard: counts identical to baseline ----
  const after = await baselineCounts();
  console.log(`\n[after-cleanup] ${JSON.stringify(after)}`);
  const noRegression =
    before.users === after.users &&
    before.accounts === after.accounts &&
    before.orgs === after.orgs &&
    before.members === after.members &&
    before.sessions === after.sessions;
  check('7. cleanup leaves DB at exact baseline (no regression)', noRegression,
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`\n[fed-jit-test] ${passed}/${results.length} passed${failed ? ` (${failed} FAILED)` : ''}`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\n[fed-jit-test] threw:', err);
  try { await cleanup(); } catch {}
  process.exit(1);
});
