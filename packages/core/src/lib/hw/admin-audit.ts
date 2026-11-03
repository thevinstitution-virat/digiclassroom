// Append-only audit of super-admin changes (roadmap section 2: "audit trail"): who, when, what, the old and new value, and why.
// The table (migration 021, hw_admin_audit) refuses UPDATE, DELETE and TRUNCATE at the database. Writers pass the transaction
// that makes the change, so a change and its audit row are saved together or not at all.

import { randomUUID } from 'node:crypto';
import { hwAdminAudit } from '@/db/hw-eval-schema';
import type { Exec } from './db';

export interface AuditEntry {
  actorId: string;
  /** What was done, e.g. 'rater_invited', 'consent_recorded', 'consent_withdrawn'. */
  action: string;
  /** What it was done to, e.g. 'rater_invite', 'consent'. */
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}

export async function writeAudit(x: Exec, e: AuditEntry): Promise<void> {
  await x.insert(hwAdminAudit).values({
    id: randomUUID(),
    actorId: e.actorId,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    oldValue: e.oldValue === undefined ? null : e.oldValue,
    newValue: e.newValue === undefined ? null : e.newValue,
    reason: e.reason ?? null,
  });
}
