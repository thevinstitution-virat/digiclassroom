// Per-institution control (roadmap 5.1): the feature switch, an optional allow-list of classes and sections, and a monthly budget in
// rupees (stored as paise), with this month's usage beside it. Super admin only. Every change writes an audit row in the same
// transaction (hw_admin_audit, append-only at the database), and the history is readable here. The institution admin's usage card
// (marking.usageThisMonth) calls tenantUsage() below, so both screens show the same numbers by construction.

import { and, desc, eq, inArray } from 'drizzle-orm';
import { institutionClasses, institutionSections, organization } from '@/db/schema';
import { hwAiUsageMonthly, hwTenantQuota, hwTenantScope } from '@/db/hw-schema';
import { hwAdminAudit } from '@/db/hw-eval-schema';
import { db, monthKey, type Exec } from './db';
import { getHwConfig } from './config';
import { HwError } from './errors';
import { writeAudit } from './admin-audit';
import { budgetStatus } from './cost/quota';
import { requireSuperAdmin, type EvalActor } from './eval-tools/access';
import { loadScope, normaliseScope, type ScopeEntry } from './tenant-scope';

export const MAX_BUDGET_PAISE = 1_000_000_000; // ₹1 crore a month; a typo guard, not a business limit
export const TENANT_ENTITY = 'tenant';

/** This month's numbers for one institution. The single source for the Tenants tab and the institution admin's usage card. */
export interface TenantUsage {
  month: string;
  pagesRead: number;
  answersGraded: number;
  costPaise: number;
  /** Answer keys built this month and what they cost (already inside costPaise). */
  keyBuilds: number;
  keyCostPaise: number;
  budgetPaise: number;
  /** 0..n; null when no budget is set. */
  fraction: number | null;
  warn: boolean;
  exhausted: boolean;
}

export async function tenantUsage(x: Exec, orgId: string): Promise<TenantUsage> {
  const month = monthKey();
  const [u] = await x.select({ pagesRead: hwAiUsageMonthly.pagesRead, answersGraded: hwAiUsageMonthly.answersGraded, costPaise: hwAiUsageMonthly.costPaise, keyBuilds: hwAiUsageMonthly.keyBuilds, keyCostPaise: hwAiUsageMonthly.keyCostPaise })
    .from(hwAiUsageMonthly).where(and(eq(hwAiUsageMonthly.organizationId, orgId), eq(hwAiUsageMonthly.month, month))).limit(1);
  const [q] = await x.select({ budget: hwTenantQuota.monthlyBudgetPaise }).from(hwTenantQuota).where(eq(hwTenantQuota.organizationId, orgId)).limit(1);
  const budgetPaise = Number(q?.budget ?? 0);
  const costPaise = Number(u?.costPaise ?? 0);
  const st = budgetStatus({ budgetPaise, usedPaise: costPaise });
  return {
    month, pagesRead: u?.pagesRead ?? 0, answersGraded: u?.answersGraded ?? 0, costPaise, keyBuilds: u?.keyBuilds ?? 0, keyCostPaise: Number(u?.keyCostPaise ?? 0), budgetPaise,
    fraction: st ? st.fraction : null, warn: st?.warn ?? false, exhausted: st?.exhausted ?? false,
  };
}

export interface TenantRow {
  organizationId: string;
  name: string;
  enabled: boolean;
  /** True when there is no hw_tenant_quota row, so the platform default decides. */
  isDefault: boolean;
  monthlyAnswerQuota: number;
  scopeRestricted: boolean;
  scope: Array<ScopeEntry & { className: string; sectionName: string | null }>;
  /** Every class and section of the institution, for the class picker. */
  classes: Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>;
  usage: TenantUsage;
}

export async function listTenants(a: EvalActor, opts: { organizationId?: string } = {}): Promise<TenantRow[]> {
  requireSuperAdmin(a);
  const orgs = await db.select({ id: organization.id, name: organization.name }).from(organization)
    .where(opts.organizationId ? eq(organization.id, opts.organizationId) : undefined).orderBy(organization.name).limit(1000);
  if (!orgs.length) return [];
  const ids = orgs.map((o) => o.id);
  const quotas = await db.select().from(hwTenantQuota).where(inArray(hwTenantQuota.organizationId, ids));
  const scopes = await db.select().from(hwTenantScope).where(inArray(hwTenantScope.organizationId, ids));
  const classes = await db.select({ id: institutionClasses.id, name: institutionClasses.name, organizationId: institutionClasses.organizationId, level: institutionClasses.level }).from(institutionClasses).where(inArray(institutionClasses.organizationId, ids));
  const sections = await db.select({ id: institutionSections.id, name: institutionSections.name, classId: institutionSections.classId, organizationId: institutionSections.organizationId }).from(institutionSections).where(inArray(institutionSections.organizationId, ids));
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const out: TenantRow[] = [];
  for (const o of orgs) {
    const q = quotas.find((r) => r.organizationId === o.id);
    out.push({
      organizationId: o.id,
      name: o.name,
      enabled: q?.enabled ?? getHwConfig().HW_FEATURE_DEFAULT_ENABLED,
      isDefault: !q,
      monthlyAnswerQuota: q?.monthlyAnswerQuota ?? 0,
      scopeRestricted: q?.scopeRestricted ?? false,
      scope: scopes.filter((s) => s.organizationId === o.id).map((s) => ({
        classId: s.classId, sectionId: s.sectionId, className: className.get(s.classId) ?? s.classId, sectionName: s.sectionId ? sectionName.get(s.sectionId) ?? s.sectionId : null,
      })),
      classes: classes.filter((c) => c.organizationId === o.id).sort((x, y) => (x.level ?? 99) - (y.level ?? 99) || x.name.localeCompare(y.name))
        .map((c) => ({ id: c.id, name: c.name, sections: sections.filter((s) => s.classId === c.id).map((s) => ({ id: s.id, name: s.name })).sort((x, y) => x.name.localeCompare(y.name)) })),
      usage: await tenantUsage(db, o.id),
    });
  }
  return out;
}

export interface TenantInput {
  organizationId: string;
  enabled: boolean;
  /** Monthly AI budget in paise; 0 = none (the older answer-count rule applies). */
  monthlyBudgetPaise: number;
  scopeRestricted: boolean;
  /** Used only when scopeRestricted. A class with sectionId null covers all its sections. */
  scope: ScopeEntry[];
  /** Why. At least 3 characters; it is stored in the audit row. */
  reason: string;
}

export async function setTenant(a: EvalActor, input: TenantInput): Promise<{ changed: boolean }> {
  requireSuperAdmin(a);
  const reason = input.reason.trim();
  if (reason.length < 3) throw new HwError('BAD_REQUEST', 'Say why you are changing this (at least 3 characters).');
  if (!Number.isInteger(input.monthlyBudgetPaise) || input.monthlyBudgetPaise < 0 || input.monthlyBudgetPaise > MAX_BUDGET_PAISE) {
    throw new HwError('BAD_REQUEST', `The monthly budget must be between ₹0 and ₹${MAX_BUDGET_PAISE / 100}.`);
  }
  const scope = input.scopeRestricted ? normaliseScope(input.scope) : [];
  if (input.scopeRestricted && !scope.length) {
    throw new HwError('BAD_REQUEST', 'Choose at least one class, or turn the class limit off. A limit with no classes would switch the feature off everywhere.');
  }
  const [org] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, input.organizationId)).limit(1);
  if (!org) throw new HwError('NOT_FOUND', 'Institution not found.');

  return db.transaction(async (tx) => {
    // Every class and section must belong to this institution; a section must belong to the class it is listed under.
    const classIds = [...new Set(scope.map((s) => s.classId))];
    if (classIds.length) {
      const have = await tx.select({ id: institutionClasses.id }).from(institutionClasses)
        .where(and(eq(institutionClasses.organizationId, input.organizationId), inArray(institutionClasses.id, classIds)));
      if (have.length !== classIds.length) throw new HwError('BAD_REQUEST', 'A class in the list does not belong to this institution.');
    }
    const sectionEntries = scope.filter((s) => s.sectionId !== null);
    if (sectionEntries.length) {
      const have = await tx.select({ id: institutionSections.id, classId: institutionSections.classId }).from(institutionSections)
        .where(and(eq(institutionSections.organizationId, input.organizationId), inArray(institutionSections.id, sectionEntries.map((s) => s.sectionId as string))));
      const ok = sectionEntries.every((s) => have.some((h) => h.id === s.sectionId && h.classId === s.classId));
      if (!ok) throw new HwError('BAD_REQUEST', 'A section in the list does not belong to its class in this institution.');
    }

    const [before] = await tx.select().from(hwTenantQuota).where(eq(hwTenantQuota.organizationId, input.organizationId)).limit(1);
    const beforeScope = await loadScope(tx, input.organizationId);
    const oldValue = {
      enabled: before?.enabled ?? getHwConfig().HW_FEATURE_DEFAULT_ENABLED,
      monthlyBudgetPaise: Number(before?.monthlyBudgetPaise ?? 0),
      scopeRestricted: before?.scopeRestricted ?? false,
      scope: normaliseScope(beforeScope.entries),
    };
    const newValue = { enabled: input.enabled, monthlyBudgetPaise: input.monthlyBudgetPaise, scopeRestricted: input.scopeRestricted, scope };
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return { changed: false };

    // Keep the older answer-count quota as it was: an institution moving to a rupee budget does not lose it, and the budget wins while it is set.
    await tx.insert(hwTenantQuota).values({
      organizationId: input.organizationId, enabled: input.enabled, monthlyAnswerQuota: before?.monthlyAnswerQuota ?? 0,
      monthlyBudgetPaise: input.monthlyBudgetPaise, scopeRestricted: input.scopeRestricted,
    }).onConflictDoUpdate({
      target: hwTenantQuota.organizationId,
      set: { enabled: input.enabled, monthlyBudgetPaise: input.monthlyBudgetPaise, scopeRestricted: input.scopeRestricted },
    });
    await tx.delete(hwTenantScope).where(eq(hwTenantScope.organizationId, input.organizationId));
    if (scope.length) await tx.insert(hwTenantScope).values(scope.map((s) => ({ organizationId: input.organizationId, classId: s.classId, sectionId: s.sectionId })));

    await writeAudit(tx, {
      actorId: a.userId, action: 'tenant_changed', entity: TENANT_ENTITY, entityId: input.organizationId, oldValue, newValue, reason,
    });
    return { changed: true };
  });
}

export interface TenantHistoryRow {
  id: string;
  at: Date;
  actorId: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
}

export async function tenantHistory(a: EvalActor, organizationId: string): Promise<TenantHistoryRow[]> {
  requireSuperAdmin(a);
  return db.select({ id: hwAdminAudit.id, at: hwAdminAudit.at, actorId: hwAdminAudit.actorId, action: hwAdminAudit.action, oldValue: hwAdminAudit.oldValue, newValue: hwAdminAudit.newValue, reason: hwAdminAudit.reason })
    .from(hwAdminAudit).where(and(eq(hwAdminAudit.entity, TENANT_ENTITY), eq(hwAdminAudit.entityId, organizationId)))
    .orderBy(desc(hwAdminAudit.at)).limit(200);
}
