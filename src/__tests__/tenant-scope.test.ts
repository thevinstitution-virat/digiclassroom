// Tenant-isolation unit tests — prove the B2B2C contract holds for every caller
// type and stays regression-proof. Pure (no DB/auth) by design.

import { tenantSql, tenantScope, requireOrgScope, type TenantContext } from '@/lib/db/tenant-scope';
import { _resetFlagsCache } from '@/lib/config/feature-flags';

const orgMember: TenantContext = { userId: 'u1', orgId: 'orgA', isPlatformBypass: false, globalRole: 'student' as any };
const b2c: TenantContext = { userId: 'u2', orgId: null, isPlatformBypass: false, globalRole: 'student' as any };
const platform: TenantContext = { userId: 'admin', orgId: 'orgA', isPlatformBypass: true, globalRole: 'super_admin' as any };

describe('tenantSql — raw-SQL isolation filters', () => {
  describe('orgOnly (org-private content)', () => {
    it('org member → only their org', () => {
      expect(tenantSql(orgMember, 'm').orgOnly()).toEqual({ clause: 'm.organization_id = ?', params: ['orgA'] });
    });
    it('B2C learner → global only (null org)', () => {
      expect(tenantSql(b2c, 'm').orgOnly()).toEqual({ clause: 'm.organization_id IS NULL', params: [] });
    });
    it('platform staff → unrestricted (sees all orgs)', () => {
      expect(tenantSql(platform, 'm').orgOnly()).toEqual({ clause: '1=1', params: [] });
    });
  });

  describe('orgOrGlobal (shared content, e.g. NCERT base)', () => {
    it('org member → their org OR global', () => {
      expect(tenantSql(orgMember, 'm').orgOrGlobal()).toEqual({
        clause: '(m.organization_id = ? OR m.organization_id IS NULL)',
        params: ['orgA'],
      });
    });
    it('B2C learner → global only', () => {
      expect(tenantSql(b2c, 'm').orgOrGlobal()).toEqual({ clause: 'm.organization_id IS NULL', params: [] });
    });
    it('platform staff → unrestricted', () => {
      expect(tenantSql(platform, 'm').orgOrGlobal()).toEqual({ clause: '1=1', params: [] });
    });
  });

  describe('personal (user-owned data)', () => {
    it('scopes strictly by user_id', () => {
      expect(tenantSql(orgMember, 'n').personal()).toEqual({ clause: 'n.user_id = ?', params: ['u1'] });
    });
    it('appends a caller-supplied extra clause + params in order', () => {
      expect(tenantSql(orgMember, 'n').personal('n.is_archived = ?', [0])).toEqual({
        clause: 'n.user_id = ? AND n.is_archived = ?',
        params: ['u1', 0],
      });
    });
  });

  it('no alias → bare column names', () => {
    expect(tenantSql(orgMember).orgOnly()).toEqual({ clause: 'organization_id = ?', params: ['orgA'] });
  });
});

describe('tenantScope — drizzle filters', () => {
  it('platform bypass → undefined (no restriction)', () => {
    const dummy = {} as any;
    expect(tenantScope(platform).orgOnly(dummy)).toBeUndefined();
    expect(tenantScope(platform).orgOrGlobal(dummy)).toBeUndefined();
  });
  it('non-platform caller → a defined filter', () => {
    // Real Drizzle columns aren't needed to assert "a filter was produced".
    const fake = { organizationId: { name: 'organization_id' } } as any;
    expect(tenantScope(orgMember).orgOnly(fake)).toBeDefined();
  });
});

describe('requireOrgScope — institution-only guard (MT_RBAC_ENFORCEMENT)', () => {
  afterEach(() => {
    delete process.env.MT_RBAC_ENFORCEMENT;
    _resetFlagsCache();
  });

  it('org member is always allowed', () => {
    expect(requireOrgScope(orgMember).ok).toBe(true);
  });
  it('platform staff is always allowed', () => {
    expect(requireOrgScope(platform).ok).toBe(true);
  });
  it('B2C is allowed while enforcement is OFF (degrades to global-only)', () => {
    process.env.MT_RBAC_ENFORCEMENT = 'false';
    _resetFlagsCache();
    expect(requireOrgScope(b2c).ok).toBe(true);
  });
  it('B2C is rejected (403) when enforcement is ON', () => {
    process.env.MT_RBAC_ENFORCEMENT = 'true';
    _resetFlagsCache();
    const r = requireOrgScope(b2c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});
