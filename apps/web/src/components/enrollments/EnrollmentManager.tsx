'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2, Search, UserMinus, UserPlus, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Status config ─────────────────────────────────────────────────────────────

type EnrollmentStatus = 'active' | 'suspended' | 'completed';

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; className: string }> = {
  active: {
    label:     'Active',
    className: 'bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300',
  },
  suspended: {
    label:     'Suspended',
    className: 'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300',
  },
  completed: {
    label:     'Completed',
    className: 'bg-muted text-muted-foreground border-transparent dark:bg-slate-800 dark:text-muted-foreground',
  },
};

function StatusBadge({ status }: { status: EnrollmentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

// ── Initials avatar ───────────────────────────────────────────────────────────

function Initials({ name, email }: { name: string | null; email: string | null }) {
  const char = (name ?? email ?? '?')[0]?.toUpperCase() ?? '?';
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
      {char}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EnrollmentManagerProps {
  batchId:   string;
  batchName: string;
}

export function EnrollmentManager({ batchId }: EnrollmentManagerProps) {
  const utils = api.useUtils();

  // ── Debounced search ───────────────────────────────────────────────────────

  const [rawQuery,       setRawQuery]       = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(rawQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const enrolled = api.enrollments.listForBatch.useQuery({ batchId });

  const searchResults = api.enrollments.searchStudents.useQuery(
    { batchId, query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 },
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    utils.enrollments.listForBatch.invalidate({ batchId });
    utils.enrollments.searchStudents.invalidate();
  };

  const enrollMutation = api.enrollments.enroll.useMutation({
    onSuccess: () => { invalidate(); toast.success('Student enrolled'); },
    onError:   (e) => toast.error(e.message),
  });

  const unenrollMutation = api.enrollments.unenroll.useMutation({
    onSuccess: () => { invalidate(); toast.success('Student removed from batch'); },
    onError:   (e) => toast.error(e.message),
  });

  const setStatusMutation = api.enrollments.setStatus.useMutation({
    onSuccess: () => {
      utils.enrollments.listForBatch.invalidate({ batchId });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* ── Left — enrolled student roster ─────────────────────────────────── */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">Enrolled Students</CardTitle>
                {(enrolled.data?.length ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {enrolled.data!.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => window.location.href = `/api/institution/batches/${batchId}/export`}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            {enrolled.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : enrolled.data?.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-muted-foreground">
                No students enrolled yet. Search on the right to add the first one.
              </p>
            ) : (
              <div className="divide-y">
                {enrolled.data?.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">

                    <Initials name={e.userName ?? null} email={e.userEmail ?? null} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.userName ?? 'Unknown'}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.userEmail}</p>
                    </div>

                    {/* Status change dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 gap-1 shrink-0"
                          disabled={setStatusMutation.isPending}
                        >
                          <StatusBadge status={(e.status ?? 'active') as EnrollmentStatus} />
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(['active', 'suspended', 'completed'] as EnrollmentStatus[]).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() =>
                              setStatusMutation.mutate({ batchId, userId: e.userId, status: s })
                            }
                            className={cn(e.status === s && 'font-semibold')}
                          >
                            {STATUS_CONFIG[s].label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Unenroll */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        unenrollMutation.mutate({ batchId, userId: e.userId })
                      }
                      disabled={unenrollMutation.isPending}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>

                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right — student search + enroll ───────────────────────────────── */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold">Add Students</CardTitle>
          </CardHeader>

          <CardContent className="px-4 pb-4 space-y-3">

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-8"
              />
            </div>

            {/* Results */}
            {debouncedQuery.length < 2 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                Type at least 2 characters to search.
              </p>
            ) : searchResults.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.data?.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                No members found matching &ldquo;{debouncedQuery}&rdquo;.
              </p>
            ) : (
              <div className="space-y-1">
                {searchResults.data?.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <Initials name={student.name ?? null} email={student.email ?? null} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{student.name ?? 'Unknown'}</p>
                      <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                    </div>

                    {student.enrolled ? (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Enrolled
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() => enrollMutation.mutate({ batchId, userId: student.id })}
                        disabled={enrollMutation.isPending}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        Enroll
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

          </CardContent>
        </Card>
      </div>

    </div>
  );
}
