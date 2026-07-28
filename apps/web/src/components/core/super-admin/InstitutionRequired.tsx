import { Building2 } from 'lucide-react';

type Props = {
  message?: string;
};

export function InstitutionRequired({
  message = 'Select a specific institution from the sidebar to continue.',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-8 py-16 text-center mt-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-950">
        <Building2 className="h-6 w-6 text-slate-500" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          No institution selected
        </p>
        <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}
