// Consent rules (roadmap task 3.1). Pure: no database, so the dataset scripts and the runner can use them offline, and the tests
// need nothing. The records themselves are in hw_eval_consent (migration 022); eval-tools/consent.ts reads and writes them.
//
// A consent record covers a SOURCE of evidence (A to F, docs/hw-eval/pilot-plan.md) for a USE (evaluation, shadow mode, the
// report). It is live until withdrawn. A student's record needs a live parent's record linked to it: withdraw the parent's and the
// student's stops covering anything, without a second action.

export const CONSENT_SOURCES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const CONSENT_USES = ['evaluation', 'shadow', 'report'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];
export type ConsentUse = (typeof CONSENT_USES)[number];

export const sourceToken = (s: ConsentSource): string => `source:${s}`;
export const useToken = (u: ConsentUse): string => `use:${u}`;
export const scopeOf = (sources: readonly ConsentSource[], uses: readonly ConsentUse[]): string[] => [...sources.map(sourceToken), ...uses.map(useToken)];

/** Real people's work: these sources need a consent record for every item. B (constructed) and F (keys) carry no person. */
export const SOURCES_NEEDING_CONSENT: ReadonlySet<string> = new Set(['A', 'C', 'D', 'E']);

export interface ConsentRecord {
  id: string;
  subjectKind: 'student' | 'parent' | 'teacher' | 'volunteer';
  scope: readonly string[];
  withdrawnAt: Date | string | null;
  guardianConsentId: string | null;
}

/** Does this record, on its own, cover the source for the use, and is it live? */
export function covers(c: ConsentRecord, source: string, use: ConsentUse): boolean {
  return !c.withdrawnAt && c.scope.includes(`source:${source}`) && c.scope.includes(useToken(use));
}

/** `covers`, and for a student also a live parent record that covers it too. */
export function coversWithGuardian(c: ConsentRecord, byId: ReadonlyMap<string, ConsentRecord>, source: string, use: ConsentUse): boolean {
  if (!covers(c, source, use)) return false;
  if (c.subjectKind !== 'student') return true;
  const g = c.guardianConsentId ? byId.get(c.guardianConsentId) : undefined;
  return !!g && g.subjectKind === 'parent' && covers(g, source, use);
}

/** Refs that no longer cover anything: withdrawn records, and students whose parent's record is withdrawn or missing. */
export function withdrawnRefs(records: readonly ConsentRecord[]): string[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const out: string[] = [];
  for (const r of records) {
    const guardianGone = r.subjectKind === 'student' && (!r.guardianConsentId || !byId.get(r.guardianConsentId) || !!byId.get(r.guardianConsentId)!.withdrawnAt);
    if (r.withdrawnAt || guardianGone) out.push(r.id);
  }
  return out.sort();
}

export interface ConsentBearing { id: string; source: string; consent: { ref: string | null } }

/**
 * Task creation: which dataset items may be worked on. An item of a real-people source (A, C, D, E) needs a live record that covers
 * its source for evaluation. Items that carry no person (B, F) pass. `lookup` is the records for the refs the items carry.
 */
export function splitByConsent<T extends ConsentBearing>(items: readonly T[], lookup: ReadonlyMap<string, ConsentRecord>, use: ConsentUse = 'evaluation'): { allowed: T[]; refused: T[] } {
  const allowed: T[] = [];
  const refused: T[] = [];
  for (const it of items) {
    if (!SOURCES_NEEDING_CONSENT.has(it.source) && !it.consent.ref) { allowed.push(it); continue; }
    const rec = it.consent.ref ? lookup.get(it.consent.ref) : undefined;
    (rec && coversWithGuardian(rec, lookup, it.source, use) ? allowed : refused).push(it);
  }
  return { allowed, refused };
}

/**
 * The runner's gate: a dataset version that holds an item whose consent was withdrawn is not run; it says which newer version to
 * use instead. `withdrawn` is the exported list of refs (hw-eval-consent.ts withdrawn). With no list, a dataset with consent refs
 * is refused unless the caller says, out loud, that consent was not checked (recorded in the run).
 */
export function consentProblems(items: readonly ConsentBearing[], withdrawn: ReadonlySet<string> | null, opts: { unchecked?: boolean } = {}): string[] {
  const withRef = items.filter((i) => i.consent.ref);
  if (!withRef.length) return [];
  if (!withdrawn) {
    return opts.unchecked ? [] : [`${withRef.length} item(s) carry a consent ref and no withdrawn-consent list was given. Export it with "hw-eval-consent withdrawn" and pass --withdrawn <file>, or pass --consent-unchecked to run without checking (this is recorded in the run).`];
  }
  const hit = withRef.filter((i) => withdrawn.has(i.consent.ref!));
  return hit.length
    ? [`${hit.length} item(s) belong to people whose consent has been withdrawn (or whose parent's has). This version cannot be run: make the next version without them (hw-eval-consent exclude) and run that.`]
    : [];
}

/** The next version's items: everything except what belongs to a withdrawn consent. */
export function excludeWithdrawn<T extends { consent: { ref: string | null } }>(items: readonly T[], withdrawn: ReadonlySet<string>): { kept: T[]; removed: number } {
  const kept = items.filter((i) => !(i.consent.ref && withdrawn.has(i.consent.ref)));
  return { kept, removed: items.length - kept.length };
}
