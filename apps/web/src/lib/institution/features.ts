// src/lib/institution/features.ts
// ============================================================================
// INSTITUTION FEATURE ENTITLEMENTS (B2B2C)
// ============================================================================
// Two-level model, stored in `organization.settings` JSON (no migration needed):
//   - allowedFeatures: granted by super_admin (the institution's plan).
//   - enabledFeatures: toggled ON by the institution admin (must be a subset of allowed).
//
// Enforcement: a student's access to a feature is gated by their org's
// enabledFeatures (B2C / no-org users get the full default set).

export interface InstitutionFeature {
  key: string;
  name: string;
  description: string;
}

/** The toggleable feature catalog (maps to student-facing surfaces). */
export const INSTITUTION_FEATURES: InstitutionFeature[] = [
  { key: 'ai_tutor', name: 'AI Tutor', description: 'NCERT-grounded AI tutoring' },
  { key: 'practest', name: 'Practest', description: 'AI assessment engine' },
  { key: 'sanchika', name: 'Sanchika Notes', description: 'Smart notes workspace' },
  { key: 'dictionary', name: 'Dictionary', description: 'English–Hindi dictionary' },
  { key: 'mitram', name: 'Mitram', description: 'Focus & aptitude assessments' },
  { key: 'productivity', name: 'Productivity Suite', description: 'Study productivity tools' },
  { key: 'materials', name: 'Study Materials', description: 'Course content library' },
  { key: 'sarvagya', name: 'Sarvagya', description: 'Document-AI research assistant' },
  { key: 'parent_portal', name: 'Parent Portal', description: 'Parent/guardian dashboard' },
];

export const ALL_FEATURE_KEYS: string[] = INSTITUTION_FEATURES.map((f) => f.key);

export interface OrgEntitlements {
  plan: string | null;
  /** Features the institution is entitled to (set by super_admin). */
  allowedFeatures: string[];
  /** Features the institution admin has turned on (⊆ allowedFeatures). */
  enabledFeatures: string[];
}

export type InstitutionPlan = 'starter' | 'professional' | 'enterprise';

/** Plan → the features an institution is entitled to (becomes allowedFeatures). */
export const PLAN_FEATURES: Record<InstitutionPlan, string[]> = {
  starter: ['ai_tutor', 'dictionary', 'materials'],
  professional: ['ai_tutor', 'dictionary', 'materials', 'practest', 'sanchika', 'mitram', 'productivity'],
  enterprise: [...ALL_FEATURE_KEYS],
};

function safeJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Parse entitlements out of `organization.settings`. Robust to string|object|null.
 * Defaults (no entitlements stored yet): everything allowed + enabled.
 */
export function parseEntitlements(settings: unknown): OrgEntitlements {
  const s =
    typeof settings === 'string' ? safeJson(settings) : (settings as Record<string, unknown> | null);
  const ent = (s?.entitlements ?? {}) as Partial<OrgEntitlements>;

  const allowed = Array.isArray(ent.allowedFeatures)
    ? ent.allowedFeatures.filter((k) => ALL_FEATURE_KEYS.includes(k))
    : [...ALL_FEATURE_KEYS];

  const enabled = Array.isArray(ent.enabledFeatures)
    ? ent.enabledFeatures.filter((k) => allowed.includes(k))
    : [...allowed];

  return {
    plan: typeof ent.plan === 'string' ? ent.plan : null,
    allowedFeatures: allowed,
    enabledFeatures: enabled,
  };
}

/** Merge updated entitlements back into a settings object for persistence. */
export function withEntitlements(settings: unknown, ent: Partial<OrgEntitlements>): Record<string, unknown> {
  const base =
    (typeof settings === 'string' ? safeJson(settings) : (settings as Record<string, unknown> | null)) ?? {};
  const current = parseEntitlements(settings);
  return { ...base, entitlements: { ...current, ...ent } };
}

/** Is a given feature enabled for an org (from its settings JSON)? */
export function isOrgFeatureEnabled(settings: unknown, key: string): boolean {
  return parseEntitlements(settings).enabledFeatures.includes(key);
}

/** super_admin: set the allowed set (the plan). Enabled is clamped to ⊆ allowed. */
export function setAllowed(settings: unknown, allowed: string[], plan?: string): Record<string, unknown> {
  const cleanAllowed = allowed.filter((k) => ALL_FEATURE_KEYS.includes(k));
  const current = parseEntitlements(settings);
  const clampedEnabled = current.enabledFeatures.filter((k) => cleanAllowed.includes(k));
  return withEntitlements(settings, {
    plan: plan ?? current.plan ?? undefined,
    allowedFeatures: cleanAllowed,
    enabledFeatures: clampedEnabled,
  });
}

/** institution admin: set enabled toggles (clamped to ⊆ allowed). */
export function setEnabled(settings: unknown, enabled: string[]): Record<string, unknown> {
  const current = parseEntitlements(settings);
  const cleanEnabled = enabled.filter((k) => current.allowedFeatures.includes(k));
  return withEntitlements(settings, { enabledFeatures: cleanEnabled });
}
