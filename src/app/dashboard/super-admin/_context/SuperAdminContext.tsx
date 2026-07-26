'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GlobalWorkingContext = {
  type: 'global';
  tenantId: 'system';
  label: 'Global Platform';
};

export type TenantWorkingContext = {
  type: 'tenant';
  tenantId: string;
  label: string;
};

export type SuperAdminWorkingContext = GlobalWorkingContext | TenantWorkingContext;

// ─── Constants ────────────────────────────────────────────────────────────────

const GLOBAL_CTX: GlobalWorkingContext = {
  type: 'global',
  tenantId: 'system',
  label: 'Global Platform',
};

const STORAGE_KEY = 'dcp_super_admin_ctx';

// ─── Context value shape ──────────────────────────────────────────────────────

type SuperAdminContextValue = {
  /** Full context object — use for display and conditional branching. */
  context: SuperAdminWorkingContext;
  /** Call this from InstitutionSwitcher to change the working institution. */
  setContext: (ctx: SuperAdminWorkingContext) => void;
  /** Shortcut boolean — true when no specific institution is selected. */
  isGlobal: boolean;
  /**
   * The tenantId to pass directly to tRPC inputs.
   * Always 'system' (global mode) or a real UUID (tenant-specific mode).
   */
  tenantId: string;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const SuperAdminCtx = createContext<SuperAdminContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SuperAdminContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [context, setContextState] = useState<SuperAdminWorkingContext>(GLOBAL_CTX);

  // Rehydrate from localStorage on mount so the selected institution
  // persists across page refreshes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SuperAdminWorkingContext;
      // Validate shape before restoring — guards against outdated stored values
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed.type === 'global' || parsed.type === 'tenant') &&
        typeof parsed.tenantId === 'string' &&
        typeof parsed.label === 'string'
      ) {
        setContextState(parsed);
      }
    } catch {
      // Corrupted storage — fall back to global silently
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setContext = useCallback((ctx: SuperAdminWorkingContext) => {
    setContextState(ctx);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    } catch {
      // Private browsing / quota exceeded — in-memory state still works
    }
  }, []);

  const value: SuperAdminContextValue = {
    context,
    setContext,
    isGlobal: context.type === 'global',
    tenantId: context.tenantId,
  };

  return (
    <SuperAdminCtx.Provider value={value}>{children}</SuperAdminCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSuperAdminContext(): SuperAdminContextValue {
  const ctx = useContext(SuperAdminCtx);
  if (!ctx) {
    throw new Error(
      '[useSuperAdminContext] Must be called inside <SuperAdminContextProvider>. ' +
        'Ensure src/app/dashboard/super-admin/layout.tsx wraps its children with this provider.',
    );
  }
  return ctx;
}
