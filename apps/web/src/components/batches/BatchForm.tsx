'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchFormValues {
  name:        string;
  description: string;
  domainId:    string;  // cascade only — not stored
  courseId:    string;  // cascade only — not stored
  levelId:     string;  // stored on the batch
  price:       number;
  startDate:   string;
  isActive:    boolean;
  maxStudents?: number | null;
  templateId?: string;
}

interface BatchFormProps {
  defaultValues?: Partial<BatchFormValues>;
  onSubmit:       (values: BatchFormValues) => Promise<void>;
  onCancel:       () => void;
  submitLabel?:   string;
}

// ── Shared native select class (matches shadcn Input height/rounding) ─────────

const SELECT_CLS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ' +
  'shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ' +
  'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

// ── Component ─────────────────────────────────────────────────────────────────

export function BatchForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = 'Create batch',
}: BatchFormProps) {
  const [values, setValues] = useState<BatchFormValues>({
    name:        defaultValues?.name        ?? '',
    description: defaultValues?.description ?? '',
    domainId:    defaultValues?.domainId    ?? '',
    courseId:    defaultValues?.courseId    ?? '',
    levelId:     defaultValues?.levelId     ?? '',
    price:       defaultValues?.price       ?? 0,
    startDate:   defaultValues?.startDate   ?? '',
    isActive:    defaultValues?.isActive    ?? true,
    maxStudents: defaultValues?.maxStudents ?? null,
  });

  const [errors,     setErrors]     = useState<Partial<Record<keyof BatchFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // ── Cascade queries ──────────────────────────────────────────────────────────

  const domains = api.taxonomy.domains.list.useQuery();
  const courses = api.taxonomy.courses.list.useQuery(
    { domainId: values.domainId },
    { enabled: !!values.domainId },
  );
  const levels = api.taxonomy.levels.list.useQuery(
    { courseId: values.courseId },
    { enabled: !!values.courseId },
  );
  
  const templates = api.institutionAdmin.getAvailableTemplates.useQuery(
    { levelId: values.levelId },
    { enabled: !!values.levelId && useTemplate }
  );

  // ── Field helpers ────────────────────────────────────────────────────────────

  function set<K extends keyof BatchFormValues>(key: K, value: BatchFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function onDomainChange(domainId: string) {
    setValues(prev => ({ ...prev, domainId, courseId: '', levelId: '' }));
    setErrors(prev => ({ ...prev, levelId: undefined }));
  }

  function onCourseChange(courseId: string) {
    setValues(prev => ({ ...prev, courseId, levelId: '' }));
    setErrors(prev => ({ ...prev, levelId: undefined }));
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Partial<Record<keyof BatchFormValues, string>> = {};
    if (!values.name.trim())  e.name    = 'Batch name is required.';
    if (!values.levelId)      e.levelId = 'Select a domain, course, and level.';
    if (values.price < 0)     e.price   = 'Price cannot be negative.';
    if (values.maxStudents !== null && values.maxStudents !== undefined && values.maxStudents < 1) e.maxStudents = 'Must be at least 1.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (useTemplate && selectedTemplate) {
        await onSubmit({ ...values, templateId: selectedTemplate });
      } else {
        await onSubmit(values);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="bf-name">
          Batch name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="bf-name"
          value={values.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. CBSE Class 10 – 2025 Batch"
          className={cn(errors.name && 'border-destructive')}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="bf-desc">Description</Label>
        <Input
          id="bf-desc"
          value={values.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Optional notes about this batch…"
        />
      </div>

      {/* Taxonomy cascade */}
      <div className="space-y-1.5">
        <Label>
          Curriculum level <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={values.domainId}
            onChange={e => onDomainChange(e.target.value)}
            disabled={domains.isLoading}
            className={SELECT_CLS}
          >
            <option value="">Domain…</option>
            {domains.data?.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={values.courseId}
            onChange={e => onCourseChange(e.target.value)}
            disabled={!values.domainId || courses.isLoading}
            className={SELECT_CLS}
          >
            <option value="">Course…</option>
            {courses.data?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={values.levelId}
            onChange={e => set('levelId', e.target.value)}
            disabled={!values.courseId || levels.isLoading}
            className={cn(SELECT_CLS, errors.levelId && 'border-destructive')}
          >
            <option value="">Level…</option>
            {levels.data?.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        {errors.levelId && (
          <p className="text-xs text-destructive">{errors.levelId}</p>
        )}

        {/* Template Toggle (only shown if level is selected) */}
        {values.levelId && (
          <div className="col-span-1 sm:col-span-3 border-t pt-4 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <input
                id="bf-use-template"
                type="checkbox"
                checked={useTemplate}
                onChange={e => {
                  setUseTemplate(e.target.checked);
                  setSelectedTemplate('');
                }}
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
              />
              <Label htmlFor="bf-use-template" className="font-medium cursor-pointer">
                Use a template
              </Label>
            </div>

            {useTemplate && (
              <div className="space-y-1.5 ml-6">
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  disabled={templates.isLoading}
                  className={SELECT_CLS}
                >
                  <option value="">Select a template…</option>
                  {templates.data?.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.description ? `— ${t.description}` : ''}
                    </option>
                  ))}
                </select>
                {templates.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">No templates available for this level.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price + Start date (hidden if using template) */}
      {!useTemplate && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bf-price">Price (₹)</Label>
            <Input
              id="bf-price"
              type="number"
              min={0}
              step={1}
              value={values.price}
              onChange={e => set('price', Math.max(0, Number(e.target.value)))}
              className={cn(errors.price && 'border-destructive')}
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bf-date">Start date</Label>
            <Input
              id="bf-date"
              type="date"
              value={values.startDate}
              onChange={e => set('startDate', e.target.value)}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="bf-max-students">Max Students</Label>
            <Input
              id="bf-max-students"
              type="number"
              min={1}
              step={1}
              placeholder="Unlimited"
              value={values.maxStudents ?? ''}
              onChange={e => {
                const val = e.target.value;
                set('maxStudents', val === '' ? null : parseInt(val, 10));
              }}
              className={cn(errors.maxStudents && 'border-destructive')}
            />
            {errors.maxStudents && <p className="text-xs text-destructive">{errors.maxStudents}</p>}
          </div>
        </div>
      )}

      {/* isActive (hidden if using template) */}
      {!useTemplate && (
        <div className="flex items-center gap-2 pt-1">
          <input
            id="bf-active"
            type="checkbox"
            checked={values.isActive}
            onChange={e => set('isActive', e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
          <Label htmlFor="bf-active" className="font-normal cursor-pointer">
            Active — students can be enrolled and access this batch
          </Label>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>

    </div>
  );
}
