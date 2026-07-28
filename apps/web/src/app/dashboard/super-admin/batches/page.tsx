'use client';

import { useState } from 'react';
import { useSuperAdminContext } from '@/app/dashboard/super-admin/_context/SuperAdminContext';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BatchForm, type BatchFormValues } from '@/components/batches/BatchForm';
import { Building2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: string | null) {
  const n = parseFloat(price ?? '0');
  return n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminBatchesPage() {
  const { isGlobal, tenantId, context } = useSuperAdminContext();
  const utils = api.useUtils();

  const [createOpen,    setCreateOpen]    = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const batchList = api.batches.sa.list.useQuery(
    { targetOrgId: tenantId },
    { enabled: !isGlobal },
  );

  const editTarget = api.batches.sa.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId },
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createBatch = api.batches.sa.create.useMutation({
    onSuccess: () => {
      utils.batches.sa.list.invalidate({ targetOrgId: tenantId });
      setCreateOpen(false);
      toast.success('Batch created');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateBatch = api.batches.sa.update.useMutation({
    onSuccess: () => {
      utils.batches.sa.list.invalidate({ targetOrgId: tenantId });
      setEditingId(null);
      toast.success('Batch updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBatch = api.batches.sa.delete.useMutation({
    onSuccess: () => {
      utils.batches.sa.list.invalidate({ targetOrgId: tenantId });
      setDeletingId(null);
      toast.success('Batch deleted');
    },
    onError: (e) => { toast.error(e.message); setDeletingId(null); },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleCreate(values: BatchFormValues) {
    await createBatch.mutateAsync({ targetOrgId: tenantId, ...values });
  }

  async function handleUpdate(values: BatchFormValues) {
    await updateBatch.mutateAsync({ id: editingId!, ...values });
  }

  // ── Global context empty state ─────────────────────────────────────────────

  if (isGlobal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold">Select an institution</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Batches are institution-specific. Choose an institution from the sidebar
          to manage its batches.
        </p>
      </div>
    );
  }

  // ── Tenant context full view ───────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {context.label}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add batch
        </Button>
      </div>

      {/* Table */}
      {batchList.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : batchList.data?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No batches yet. Create the first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchList.data?.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.name}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-xs">
                      {batch.domainName} / {batch.courseName} /
                    </span>{' '}
                    {batch.levelName}
                  </TableCell>
                  <TableCell>{formatPrice(batch.price)}</TableCell>
                  <TableCell>{formatDate(batch.startDate as any)}</TableCell>
                  <TableCell>
                    <Badge variant={batch.isActive ? 'default' : 'secondary'}>
                      {batch.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingId(batch.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingId(batch.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New batch — {context.label}</DialogTitle>
          </DialogHeader>
          <BatchForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            submitLabel="Create batch"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit batch</DialogTitle>
          </DialogHeader>
          {editTarget.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : editTarget.data ? (
            <BatchForm
              key={editingId}
              defaultValues={{
                name:        editTarget.data.name,
                description: editTarget.data.description ?? '',
                domainId:    editTarget.data.domainId    ?? '',
                courseId:    editTarget.data.courseId    ?? '',
                levelId:     editTarget.data.levelId ?? '',
                price:       parseFloat(String(editTarget.data.price ?? '0')),
                startDate:   editTarget.data.startDate as any   ?? '',
                isActive:    editTarget.data.isActive ?? true,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingId(null)}
              submitLabel="Save changes"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete batch?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the batch and its configuration.
            Batches with enrolled students cannot be deleted.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
              disabled={deleteBatch.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBatch.mutate({ id: deletingId! })}
              disabled={deleteBatch.isPending}
            >
              {deleteBatch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
