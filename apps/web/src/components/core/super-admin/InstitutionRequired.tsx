import { Building2 } from 'lucide-react';

type Props = {
  message?: string;
};

export function InstitutionRequired({
  message = 'Select a specific institution from the sidebar to continue.',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border dark:border-slate-800 bg-muted/40 dark:bg-slate-900 px-8 py-16 text-center mt-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-950">
        <Building2 className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground dark:text-white">
          No institution selected
        </p>
        <p className="max-w-xs text-xs text-muted-foreground dark:text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
