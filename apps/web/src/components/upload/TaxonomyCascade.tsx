'use client';

import { api } from '@/lib/trpc/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TaxonomySelection {
  domainId:  string;
  courseId:  string;
  levelId:   string;
  subjectId: string;
}

interface TaxonomyCascadeProps {
  value:     Partial<TaxonomySelection>;
  onChange:  (value: Partial<TaxonomySelection>) => void;
  disabled?: boolean;
}

export function TaxonomyCascade({ value, onChange, disabled }: TaxonomyCascadeProps) {

  const domains  = api.taxonomy.domains.list.useQuery();
  const courses  = api.taxonomy.courses.list.useQuery(
    { domainId: value.domainId! },
    { enabled: !!value.domainId },
  );
  const levels   = api.taxonomy.levels.list.useQuery(
    { courseId: value.courseId! },
    { enabled: !!value.courseId },
  );
  const subjects = api.taxonomy.subjects.list.useQuery(
    { levelId: value.levelId! },
    { enabled: !!value.levelId },
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      {/* Domain */}
      <div className="space-y-1.5">
        <Label>Domain <span className="text-destructive">*</span></Label>
        <Select
          value={value.domainId ?? ''}
          onValueChange={(v) => onChange({ domainId: v })} // resets all downstream
          disabled={disabled || domains.isLoading}
        >
          <SelectTrigger><SelectValue placeholder="Select domain…" /></SelectTrigger>
          <SelectContent>
            {domains.data?.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Course */}
      <div className="space-y-1.5">
        <Label>Course <span className="text-destructive">*</span></Label>
        <Select
          value={value.courseId ?? ''}
          onValueChange={(v) =>
            onChange({ domainId: value.domainId, courseId: v }) // resets levelId, subjectId
          }
          disabled={disabled || !value.domainId || courses.isLoading}
        >
          <SelectTrigger><SelectValue placeholder="Select course…" /></SelectTrigger>
          <SelectContent>
            {courses.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Level */}
      <div className="space-y-1.5">
        <Label>Level <span className="text-destructive">*</span></Label>
        <Select
          value={value.levelId ?? ''}
          onValueChange={(v) =>
            onChange({ domainId: value.domainId, courseId: value.courseId, levelId: v }) // resets subjectId
          }
          disabled={disabled || !value.courseId || levels.isLoading}
        >
          <SelectTrigger><SelectValue placeholder="Select level…" /></SelectTrigger>
          <SelectContent>
            {levels.data?.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label>Subject <span className="text-destructive">*</span></Label>
        <Select
          value={value.subjectId ?? ''}
          onValueChange={(v) => onChange({ ...value, subjectId: v })}
          disabled={disabled || !value.levelId || subjects.isLoading}
        >
          <SelectTrigger><SelectValue placeholder="Select subject…" /></SelectTrigger>
          <SelectContent>
            {subjects.data?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
}
