'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Globe, Loader2 } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import {
  useSuperAdminContext,
  type SuperAdminWorkingContext,
} from '@/app/dashboard/super-admin/_context/SuperAdminContext';

function cx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function InstitutionSwitcher() {
  const { context, setContext } = useSuperAdminContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tenants, isLoading, isError } =
    api.tenantFeatures.getAllTenantsWithFeatures.useQuery();

  // Close dropdown when user clicks outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelectGlobal = () => {
    setContext({ type: 'global', tenantId: 'system', label: 'Global Platform' });
    setOpen(false);
  };

  const handleSelectTenant = (tenant: { id: string; name: string }) => {
    const next: SuperAdminWorkingContext = {
      type: 'tenant',
      tenantId: tenant.id,
      label: tenant.name,
    };
    setContext(next);
    setOpen(false);
  };

  const isGlobal = context.type === 'global';

  return (
    <div ref={containerRef} className="relative w-full">

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex min-w-0 items-center gap-2">
          {isGlobal ? (
            <Globe className="h-4 w-4 shrink-0 text-blue-500" />
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
          )}
          <span className="truncate font-medium">{context.label}</span>
        </span>
        <ChevronDown
          className={cx(
            'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg">

          {/* Global Platform — always first */}
          <OptionRow
            icon={<Globe className="h-4 w-4 text-blue-500" />}
            label="Global Platform"
            sublabel="Cross-institution content"
            active={isGlobal}
            isFirst
            onClick={handleSelectGlobal}
          />

          <div className="mx-3 border-t border-slate-100 dark:border-slate-800" />

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading institutions…
            </div>
          )}

          {/* Error state */}
          {isError && (
            <p className="px-3 py-3 text-xs text-red-500">
              Failed to load institutions. Refresh and try again.
            </p>
          )}

          {/* Empty state */}
          {!isLoading && !isError && (!tenants || tenants.length === 0) && (
            <p className="px-3 py-3 text-xs text-slate-500">
              No institutions found.
            </p>
          )}

          {/* Institution list */}
          <div className="max-h-64 overflow-y-auto">
            {tenants?.map((tenant, idx) => (
              <OptionRow
                key={tenant.tenant_id}
                icon={<Building2 className="h-4 w-4 text-slate-500" />}
                label={tenant.tenant_name || tenant.tenant_id}
                active={context.tenantId === tenant.tenant_id}
                isLast={idx === tenants.length - 1}
                onClick={() =>
                  handleSelectTenant({ id: tenant.tenant_id, name: tenant.tenant_name || tenant.tenant_id })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Internal sub-component ───────────────────────────────────────────────────

function OptionRow({
  icon,
  label,
  sublabel,
  active,
  onClick,
  isFirst,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900',
        active ? 'bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200',
        isFirst && 'rounded-t-lg',
        isLast && 'rounded-b-lg',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block truncate font-medium',
            active && 'text-indigo-600 dark:text-indigo-400',
          )}
        >
          {label}
        </span>
        {sublabel && (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {sublabel}
          </span>
        )}
      </span>
      {active && (
        <span className="ml-auto shrink-0 self-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400">
          Active
        </span>
      )}
    </button>
  );
}
