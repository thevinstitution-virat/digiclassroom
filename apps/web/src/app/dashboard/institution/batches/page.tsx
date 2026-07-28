'use client';

import { useState } from 'react';
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
import { BatchJoinCodePanel } from '@/components/batches/BatchJoinCodePanel';
import { BatchAnnouncementsTab } from '@/components/batches/BatchAnnouncementsTab';
import { BatchCouponsTab } from '@/components/batches/BatchCouponsTab';
import { BatchQuizzesTab } from '@/components/batches/BatchQuizzesTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Loader2, Pencil, Plus, Trash2, Users, BarChart } from 'lucide-react';

// ── Helpers (same as SA page) ─────────────────────────────────────────────────

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

export default function InstitutionBatchesPage() {
  const utils = api.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const batchList  = api.batches.list.useQuery();
  const editTarget = api.batches.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId },
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createBatch = api.batches.create.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      setCreateOpen(false);
      toast.success('Batch created');
    },
    onError: (e) => toast.error(e.message),
  });

  const cloneTemplate = api.institutionAdmin.cloneTemplate.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      setCreateOpen(false);
      toast.success('Batch cloned successfully');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateBatch = api.batches.update.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      setEditingId(null);
      toast.success('Batch updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBatch = api.batches.delete.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      setDeletingId(null);
      toast.success('Batch deleted');
    },
    onError: (e) => { toast.error(e.message); setDeletingId(null); },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleCreate(values: BatchFormValues) {
    if (values.templateId) {
      await cloneTemplate.mutateAsync({
        templateId: values.templateId,
        name: values.name,
      });
    } else {
      await createBatch.mutateAsync(values);
    }
  }

  async function handleUpdate(values: BatchFormValues) {
    await updateBatch.mutateAsync({ id: editingId!, ...values });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your institution's course batches and student enrollment groups.
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
              No batches yet. Create your first batch to start enrolling students.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create first batch
            </Button>
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
                      {/* Manage enrollments */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        asChild
                      >
                        <Link href={`/dashboard/institution/batches/${batch.id}/enrollments`}>
                          <Users className="h-3.5 w-3.5" />
                        </Link>
                      </Button>

                      {/* Analytics */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        asChild
                      >
                        <Link href={`/dashboard/institution/analytics/${batch.id}`}>
                          <BarChart className="h-3.5 w-3.5" />
                        </Link>
                      </Button>

                      {/* Edit */}
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
            <DialogTitle>New batch</DialogTitle>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit batch</DialogTitle>
          </DialogHeader>
          {editTarget.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : editTarget.data ? (
            <Tabs defaultValue="settings" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="announcements">Announcements</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
                <TabsTrigger value="coupons">Coupons</TabsTrigger>
              </TabsList>
              
              <TabsContent value="settings" className="space-y-4 flex-1 overflow-y-auto pr-2 mt-4">
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
                <BatchJoinCodePanel batchId={editingId} />
              </TabsContent>

              <TabsContent value="announcements" className="flex-1 overflow-hidden flex flex-col mt-0">
                <BatchAnnouncementsTab batchId={editingId} />
              </TabsContent>

              <TabsContent value="quizzes" className="flex-1 overflow-hidden flex flex-col mt-0 p-4 overflow-y-auto">
                <BatchQuizzesTab batchId={editingId} />
              </TabsContent>

              <TabsContent value="coupons" className="flex-1 overflow-hidden flex flex-col mt-0">
                <BatchCouponsTab batchId={editingId} />
              </TabsContent>
            </Tabs>
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
            This permanently removes the batch. Batches with enrolled students
            cannot be deleted — remove all enrollments first.
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
