// src/auth/permissions.ts
// Phase 1: Add super_admin tier above admin.
// admin permissions are UNCHANGED from pre-Phase-1 (narrowing happens in Phase 2).
// super_admin gets everything admin has PLUS 'manage:platform'.

export const roles = {
  super_admin: 'super_admin',
  admin: 'admin',
  teacher: 'teacher',
  student: 'student',
  parent: 'parent',
} as const;

export type Role = (typeof roles)[keyof typeof roles];

// Org-scoped member roles (unchanged — owner/org_admin already model institution admin)
export const orgRoles = {
  owner: 'owner',
  org_admin: 'org_admin',
  teacher: 'teacher',
  student: 'student',
  parent: 'parent',
} as const;

export type OrgRole = (typeof orgRoles)[keyof typeof orgRoles];

// ─── Permissions ─────────────────────────────────────────────────────────────

type Permission =
  | 'read:all'
  | 'write:all'
  | 'delete:all'
  | 'manage:orgs'
  | 'manage:platform'   // NEW — super_admin only; used to gate Qdrant, ingestion, global user CRUD
  | 'read:own'
  | 'write:own'
  | 'manage:class';

export const permissions: Record<Role, Permission[]> = {
  // God-mode: everything including platform-level ops
  super_admin: [
    'read:all',
    'write:all',
    'delete:all',
    'manage:orgs',
    'manage:platform',
  ],

  // Platform staff: same as before Phase 1 — DO NOT narrow until Phase 2
  admin: [
    'read:all',
    'write:all',
    'delete:all',
    'manage:orgs',
  ],

  teacher: ['read:own', 'write:own', 'manage:class'],
  student: ['read:own', 'write:own'],
  parent:  ['read:own'],
};

// Org-scoped permission map (unchanged)
export const orgPermissions: Record<OrgRole, Permission[]> = {
  owner:     ['read:all', 'write:all', 'delete:all', 'manage:orgs'],
  org_admin: ['read:all', 'write:all', 'manage:orgs'],
  teacher:   ['read:own', 'write:own', 'manage:class'],
  student:   ['read:own', 'write:own'],
  parent:    ['read:own'],
};

// ─── hasPermission ────────────────────────────────────────────────────────────

/**
 * Check if a global role has a given permission.
 *
 * super_admin short-circuits to true for every permission.
 * admin retains its pre-Phase-1 full bypass (transition safety).
 * Phase 2 will narrow admin's bypass to exclude 'manage:platform' routes.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  // super_admin: unconditional god-mode
  if (role === 'super_admin') return true;

  // admin: kept as full platform staff bypass during Phase 1 transition
  if (role === 'admin') return true;

  return permissions[role]?.includes(permission) ?? false;
}

/**
 * Check if an org-scoped role has a given permission.
 */
export function hasOrgPermission(orgRole: OrgRole, permission: Permission): boolean {
  return orgPermissions[orgRole]?.includes(permission) ?? false;
}

/**
 * Returns true if the global role is platform-level.
 *
 * B2B2C model: super_admin is the SOLE platform tier. `admin` is the INSTITUTION
 * administrator (org-scoped), so it is NOT platform staff. Platform routes
 * (/api/super-admin/*, global content, all-orgs) therefore require super_admin.
 */
export function isPlatformStaff(role: Role): boolean {
  return role === 'super_admin';
}

/**
 * Returns true if the global role is the platform owner.
 * Use this to gate 'manage:platform' surfaces (Qdrant, ingestion, global user CRUD).
 * Phase 2 will migrate admin-gated routes here progressively.
 */
export function isPlatformOwner(role: Role): boolean {
  return role === 'super_admin';
}

/**
 * Returns true if an org member role qualifies as institution admin.
 */
export function isInstitutionAdmin(orgRole: OrgRole): boolean {
  return orgRole === 'owner' || orgRole === 'org_admin';
}
