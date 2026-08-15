'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TaxonomyCascade, TaxonomySelection } from '@/components/upload/TaxonomyCascade';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function BatchTemplatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taxonomy, setTaxonomy] = useState<Partial<TaxonomySelection>>({});

  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.batchTemplates.list.useQuery();

  const createMutation = trpc.batchTemplates.create.useMutation({
    onSuccess: () => {
      toast.success('Template created successfully');
      setIsDialogOpen(false);
      setName('');
      setDescription('');
      setTaxonomy({});
      utils.batchTemplates.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create template');
    }
  });

  const deleteMutation = trpc.batchTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success('Template deleted');
      utils.batchTemplates.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete template');
    }
  });

  const handleCreate = () => {
    if (!name.trim()) return toast.error('Name is required');
    if (!taxonomy.levelId) return toast.error('Level selection is required');

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      levelId: taxonomy.levelId,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-2xl font-bold text-transparent">
            Batch Templates
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage global templates that institution admins can clone.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Batch Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <TaxonomyCascade 
                value={taxonomy} 
                onChange={setTaxonomy} 
                disabled={createMutation.isPending} 
              />
              
              <div className="space-y-1.5">
                <Label>Template Name <span className="text-destructive">*</span></Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Foundations Batch"
                  disabled={createMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={createMutation.isPending}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={createMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending || !name || !taxonomy.levelId}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : templates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No batch templates found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              templates?.map(template => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    {template.name}
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    )}
                  </TableCell>
                  <TableCell>{template.domainName}</TableCell>
                  <TableCell>{template.courseName}</TableCell>
                  <TableCell>{template.levelName}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
