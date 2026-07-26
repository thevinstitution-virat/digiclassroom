/**
 * Federation reconciliation — DigiClassroom Pro ↔ Vidyaverse.
 *
 * Usage:
 *   npx tsx scripts/reconcile-with-vidyaverse.ts              # dry-run, CSV to stdout
 *   npx tsx scripts/reconcile-with-vidyaverse.ts --commit     # writes account link rows
 *
 * Required env:
 *   DATABASE_URL            DCP DB connection string
 *   VIDYAVERSE_ISSUER       (e.g. https://api.vgraphics.in)
 *   VIDYAVERSE_ADMIN_TOKEN  super-admin bearer token from Vidyaverse
 *
 * Mirrors PDLMS_Pro/scripts/reconcile-with-vidyaverse.ts. DCP-specific: writes
 * to the Better Auth `account` table (NOT the legacy `users` table — federation
 * uses Better Auth only). See identity-federation-design.md §11.
 */
import { db } from '../src/db';
import { user as userTable, account as accountTable } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const COMMIT = process.argv.includes('--commit');
const VIDYAVERSE_ISSUER = process.env.VIDYAVERSE_ISSUER;
const VIDYAVERSE_ADMIN_TOKEN = process.env.VIDYAVERSE_ADMIN_TOKEN;

interface VidyaverseUserExport {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  alternateEmails: string[];
  memberships: Array<{ institutionId: string; institutionCode: string; institutionName: string; role: string }>;
}

async function fetchVidyaverseUsers(): Promise<VidyaverseUserExport[]> {
  if (!VIDYAVERSE_ISSUER || !VIDYAVERSE_ADMIN_TOKEN) {
    throw new Error('VIDYAVERSE_ISSUER and VIDYAVERSE_ADMIN_TOKEN are required.');
  }
  const all: VidyaverseUserExport[] = [];
  let cursor: string | null = null;
  for (;;) {
    const url = new URL(`${VIDYAVERSE_ISSUER.replace(/\/$/, '')}/api/v1/admin/users/export`);
    url.searchParams.set('limit', '500');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${VIDYAVERSE_ADMIN_TOKEN}` } });
    if (!res.ok) throw new Error(`Vidyaverse export ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { data: VidyaverseUserExport[]; nextCursor: string | null };
    all.push(...body.data);
    if (!body.nextCursor) break;
    cursor = body.nextCursor;
  }
  return all;
}

async function fetchDcpUsersByEmail(): Promise<Map<string, { id: string; email: string }[]>> {
  const rows = await db.select({ id: userTable.id, email: userTable.email }).from(userTable);
  const m = new Map<string, { id: string; email: string }[]>();
  for (const r of rows) {
    const key = r.email.toLowerCase();
    const list = m.get(key) ?? [];
    list.push(r);
    m.set(key, list);
  }
  return m;
}

async function existingFederationLinks(): Promise<Set<string>> {
  const rows = await db
    .select({ userId: accountTable.userId, accountId: accountTable.accountId })
    .from(accountTable)
    .where(eq(accountTable.providerId, 'vidyaverse'));
  return new Set(rows.map((r) => `${r.userId}:${r.accountId}`));
}

interface Row {
  dcpUserId: string | null;
  dcpEmail: string | null;
  vidyaverseUserId: string;
  vidyaverseEmail: string;
  confidence: 'HIGH' | 'AMBIGUOUS' | 'NEW';
  action: 'AUTO_LINK' | 'MANUAL_REVIEW' | 'NEW' | 'NONE';
  notes: string;
}

function csvEscape(v: string | null): string {
  if (v === null) return '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main() {
  console.error(`[reconcile-dcp] mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  console.error(`[reconcile-dcp] vidyaverse: ${VIDYAVERSE_ISSUER}`);
  const vvUsers = await fetchVidyaverseUsers();
  console.error(`[reconcile-dcp] vidyaverse exported ${vvUsers.length} users`);
  const dcpByEmail = await fetchDcpUsersByEmail();
  const alreadyLinked = await existingFederationLinks();

  const rows: Row[] = [];
  let autoLinked = 0;
  let manualReview = 0;
  let willCreate = 0;
  let alreadyLinkedCount = 0;

  for (const v of vvUsers) {
    const candidates = new Set<string>([v.email.toLowerCase(), ...v.alternateEmails.map((e) => e.toLowerCase())]);
    const matches: { id: string; email: string }[] = [];
    for (const email of candidates) {
      for (const u of dcpByEmail.get(email) ?? []) matches.push(u);
    }

    if (matches.length === 0) {
      rows.push({
        dcpUserId: null,
        dcpEmail: null,
        vidyaverseUserId: v.id,
        vidyaverseEmail: v.email,
        confidence: 'NEW',
        action: 'NEW',
        notes: `Will JIT-create on first sign-in (${v.memberships.length} memberships)`,
      });
      willCreate++;
    } else if (matches.length > 1) {
      rows.push({
        dcpUserId: matches.map((m) => m.id).join('|'),
        dcpEmail: v.email,
        vidyaverseUserId: v.id,
        vidyaverseEmail: v.email,
        confidence: 'AMBIGUOUS',
        action: 'MANUAL_REVIEW',
        notes: `${matches.length} local DCP users share this email`,
      });
      manualReview++;
    } else {
      const u = matches[0];
      const isLinked = alreadyLinked.has(`${u.id}:${v.id}`);
      rows.push({
        dcpUserId: u.id,
        dcpEmail: u.email,
        vidyaverseUserId: v.id,
        vidyaverseEmail: v.email,
        confidence: 'HIGH',
        action: isLinked ? 'NONE' : 'AUTO_LINK',
        notes: isLinked ? 'Already linked' : `${v.memberships.length} memberships from Vidyaverse`,
      });
      if (isLinked) alreadyLinkedCount++;
      else autoLinked++;

      if (COMMIT && !isLinked) {
        await db.insert(accountTable).values({
          id: randomUUID(),
          accountId: v.id,
          providerId: 'vidyaverse',
          userId: u.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  console.log('dcp_user_id,dcp_email,vidyaverse_user_id,vidyaverse_email,confidence,action,notes');
  for (const r of rows) {
    console.log(
      [r.dcpUserId, r.dcpEmail, r.vidyaverseUserId, r.vidyaverseEmail, r.confidence, r.action, r.notes]
        .map((c) => csvEscape(typeof c === 'string' || c === null ? c : String(c)))
        .join(','),
    );
  }

  console.error(`\n[reconcile-dcp] summary:`);
  console.error(`  HIGH (auto-link):      ${autoLinked}${COMMIT ? ' WRITTEN' : ' would-write'}`);
  console.error(`  HIGH (already linked): ${alreadyLinkedCount}`);
  console.error(`  AMBIGUOUS:             ${manualReview}`);
  console.error(`  NEW (JIT on login):    ${willCreate}`);
  console.error(`  total processed:       ${vvUsers.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('reconcile-dcp FAILED:', err);
    process.exit(1);
  });
