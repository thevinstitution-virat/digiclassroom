'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── TaxonomyRow ──────────────────────────────────────────────────────────────

interface RowProps {
  item: { id: string; name: string; sortOrder: number };
  isSelected: boolean;
  onSelect?: () => void;
  onUpdate: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function TaxonomyRow({ item, isSelected, onSelect, onUpdate, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try { await onUpdate(trimmed); setEditing(false); }
    finally { setSaving(false); }
  }

  function handleCancelEdit() { setName(item.name); setEditing(false); }

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete(); }
    finally { setDeleting(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancelEdit();
          }}
          className="h-7 text-sm"
          autoFocus
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleCancelEdit}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
        onSelect ? 'cursor-pointer' : 'cursor-default',
        isSelected
          ? 'bg-primary/10 text-primary font-medium'
          : onSelect
          ? 'hover:bg-muted/60 text-foreground'
          : 'text-foreground',
      )}
      onClick={onSelect}
    >
      {onSelect && (
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground/50',
            isSelected && 'rotate-90 text-primary',
          )}
        />
      )}
      <span className="flex-1 text-sm truncate">{item.name}</span>
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => { setName(item.name); setEditing(true); }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

// ── AddRow ───────────────────────────────────────────────────────────────────

interface AddRowProps {
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
}

function AddRow({ placeholder, onAdd }: AddRowProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try { await onAdd(trimmed); setName(''); setOpen(false); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {placeholder}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name…"
        className="h-7 text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
          if (e.key === 'Escape') { setOpen(false); setName(''); }
        }}
      />
      <Button
        size="sm"
        className="h-7 px-3 text-xs shrink-0"
        onClick={handleAdd}
        disabled={saving || !name.trim()}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={() => { setOpen(false); setName(''); }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── TaxonomySection ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  parentChip?: string;
  items: Array<{ id: string; name: string; sortOrder: number }> | undefined;
  isLoading: boolean;
  gated: boolean;
  gatedMessage: string;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  addPlaceholder: string;
}

function TaxonomySection({
  title, parentChip, items, isLoading, gated, gatedMessage,
  selectedId, onSelect, onAdd, onUpdate, onDelete, addPlaceholder,
}: SectionProps) {
  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {parentChip && (
              <Badge variant="secondary" className="text-xs font-normal">
                in: {parentChip}
              </Badge>
            )}
          </div>
          {!gated && items && items.length > 0 && (
            <Badge variant="outline" className="text-xs tabular-nums">{items.length}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-2">
        {gated ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{gatedMessage}</p>
        ) : isLoading ? (
          <div className="space-y-1 px-1 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <>
            <div className="space-y-0.5">
              {items.map((item) => (
                <TaxonomyRow
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={onSelect ? () => onSelect(selectedId === item.id ? null : item.id) : undefined}
                  onUpdate={(name) => onUpdate(item.id, name)}
                  onDelete={() => onDelete(item.id)}
                />
              ))}
            </div>
            <AddRow placeholder={addPlaceholder} onAdd={onAdd} />
          </>
        ) : (
          <>
            <p className="px-3 py-2 text-xs text-muted-foreground">No items yet.</p>
            <AddRow placeholder={addPlaceholder} onAdd={onAdd} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TaxonomyPage() {
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  const utils = api.useUtils();

  // ── Selection handlers (cascade resets) ────────────────────────────────────

  function selectDomain(id: string | null) {
    setSelectedDomainId(id);
    setSelectedCourseId(null);
    setSelectedLevelId(null);
  }

  function selectCourse(id: string | null) {
    setSelectedCourseId(id);
    setSelectedLevelId(null);
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  const domains  = api.taxonomy.domains.list.useQuery();
  const courses  = api.taxonomy.courses.list.useQuery(
    { domainId: selectedDomainId! },
    { enabled: !!selectedDomainId },
  );
  const levels   = api.taxonomy.levels.list.useQuery(
    { courseId: selectedCourseId! },
    { enabled: !!selectedCourseId },
  );
  const subjects = api.taxonomy.subjects.list.useQuery(
    { levelId: selectedLevelId! },
    { enabled: !!selectedLevelId },
  );

  // ── Mutations: Domains ─────────────────────────────────────────────────────

  const createDomain = api.taxonomy.domains.create.useMutation({
    onSuccess: () => { utils.taxonomy.domains.list.invalidate(); toast.success('Domain added'); },
    onError:   (e) => toast.error(e.message),
  });
  const updateDomain = api.taxonomy.domains.update.useMutation({
    onSuccess: () => { utils.taxonomy.domains.list.invalidate(); toast.success('Domain updated'); },
    onError:   (e) => toast.error(e.message),
  });
  const deleteDomain = api.taxonomy.domains.delete.useMutation({
    onSuccess: (_, vars) => {
      if (selectedDomainId === vars.id) selectDomain(null);
      utils.taxonomy.domains.list.invalidate();
      toast.success('Domain deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Mutations: Courses ─────────────────────────────────────────────────────

  const createCourse = api.taxonomy.courses.create.useMutation({
    onSuccess: () => { utils.taxonomy.courses.list.invalidate(); toast.success('Course added'); },
    onError:   (e) => toast.error(e.message),
  });
  const updateCourse = api.taxonomy.courses.update.useMutation({
    onSuccess: () => { utils.taxonomy.courses.list.invalidate(); toast.success('Course updated'); },
    onError:   (e) => toast.error(e.message),
  });
  const deleteCourse = api.taxonomy.courses.delete.useMutation({
    onSuccess: (_, vars) => {
      if (selectedCourseId === vars.id) selectCourse(null);
      utils.taxonomy.courses.list.invalidate();
      toast.success('Course deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Mutations: Levels ──────────────────────────────────────────────────────

  const createLevel = api.taxonomy.levels.create.useMutation({
    onSuccess: () => { utils.taxonomy.levels.list.invalidate(); toast.success('Level added'); },
    onError:   (e) => toast.error(e.message),
  });
  const updateLevel = api.taxonomy.levels.update.useMutation({
    onSuccess: () => { utils.taxonomy.levels.list.invalidate(); toast.success('Level updated'); },
    onError:   (e) => toast.error(e.message),
  });
  const deleteLevel = api.taxonomy.levels.delete.useMutation({
    onSuccess: (_, vars) => {
      if (selectedLevelId === vars.id) setSelectedLevelId(null);
      utils.taxonomy.levels.list.invalidate();
      toast.success('Level deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Mutations: Subjects ────────────────────────────────────────────────────

  const createSubject = api.taxonomy.subjects.create.useMutation({
    onSuccess: () => { utils.taxonomy.subjects.list.invalidate(); toast.success('Subject added'); },
    onError:   (e) => toast.error(e.message),
  });
  const updateSubject = api.taxonomy.subjects.update.useMutation({
    onSuccess: () => { utils.taxonomy.subjects.list.invalidate(); toast.success('Subject updated'); },
    onError:   (e) => toast.error(e.message),
  });
  const deleteSubject = api.taxonomy.subjects.delete.useMutation({
    onSuccess: () => { utils.taxonomy.subjects.list.invalidate(); toast.success('Subject deleted'); },
    onError:   (e) => toast.error(e.message),
  });

  // ── Derived labels for parent chips ───────────────────────────────────────

  const selectedDomainName  = domains.data?.find((d) => d.id === selectedDomainId)?.name;
  const selectedCourseName  = courses.data?.find((c) => c.id === selectedCourseId)?.name;
  const selectedLevelName   = levels.data?.find((l) => l.id === selectedLevelId)?.name;

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Curriculum Taxonomy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build the curriculum hierarchy used across all institutions and content.
          Select an item to drill down and manage its children.
        </p>
      </div>

      <TaxonomySection
        title="Domains"
        items={domains.data}
        isLoading={domains.isLoading}
        gated={false}
        gatedMessage=""
        selectedId={selectedDomainId}
        onSelect={selectDomain}
        onAdd={(name) =>
          createDomain.mutateAsync({ name, sortOrder: domains.data?.length ?? 0 })
        }
        onUpdate={(id, name) => updateDomain.mutateAsync({ id, name })}
        onDelete={(id) => deleteDomain.mutateAsync({ id })}
        addPlaceholder="Add domain"
      />

      <TaxonomySection
        title="Courses"
        parentChip={selectedDomainName}
        items={courses.data}
        isLoading={courses.isLoading}
        gated={!selectedDomainId}
        gatedMessage="Select a domain above to manage its courses."
        selectedId={selectedCourseId}
        onSelect={selectCourse}
        onAdd={(name) =>
          createCourse.mutateAsync({ name, domainId: selectedDomainId!, sortOrder: courses.data?.length ?? 0 })
        }
        onUpdate={(id, name) => updateCourse.mutateAsync({ id, name })}
        onDelete={(id) => deleteCourse.mutateAsync({ id })}
        addPlaceholder="Add course"
      />

      <TaxonomySection
        title="Levels"
        parentChip={selectedCourseName}
        items={levels.data}
        isLoading={levels.isLoading}
        gated={!selectedCourseId}
        gatedMessage="Select a course above to manage its levels."
        selectedId={selectedLevelId}
        onSelect={(id) => setSelectedLevelId(id)}
        onAdd={(name) =>
          createLevel.mutateAsync({ name, courseId: selectedCourseId!, sortOrder: levels.data?.length ?? 0 })
        }
        onUpdate={(id, name) => updateLevel.mutateAsync({ id, name })}
        onDelete={(id) => deleteLevel.mutateAsync({ id })}
        addPlaceholder="Add level"
      />

      <TaxonomySection
        title="Subjects"
        parentChip={selectedLevelName}
        items={subjects.data}
        isLoading={subjects.isLoading}
        gated={!selectedLevelId}
        gatedMessage="Select a level above to manage its subjects."
        selectedId={null}
        // Subjects are leaf nodes — no onSelect, rows are not clickable
        onAdd={(name) =>
          createSubject.mutateAsync({ name, levelId: selectedLevelId!, sortOrder: subjects.data?.length ?? 0 })
        }
        onUpdate={(id, name) => updateSubject.mutateAsync({ id, name })}
        onDelete={(id) => deleteSubject.mutateAsync({ id })}
        addPlaceholder="Add subject"
      />
    </div>
  );
}
