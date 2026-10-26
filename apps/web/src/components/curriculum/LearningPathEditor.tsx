'use client';

import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LearningGoalSelector, type GoalSelection } from '@/components/curriculum/LearningGoalSelector';
import { TaxonomyPicker } from '@/components/curriculum/TaxonomyPicker';
import { GOAL_TYPES, MAX_GOALS, MEDIUMS, type GoalInput, type LearningGoal } from '@/lib/learning-path/client';

interface Extra {
  id: string;
  name: string;
  path: string;
}

interface Props {
  /** The goals already saved, when editing. */
  initial?: LearningGoal[];
  /** The medium already saved, when editing. */
  initialMedium?: string | null;
  submitLabel: string;
  /** Saves the goals and the medium; returns an error message to show, or null on success. */
  onSubmit: (goals: GoalInput[], medium: string | undefined) => Promise<string | null>;
  /** "I'm just exploring": saves no goals (the medium still, when chosen). Omit to hide the option. */
  onSkip?: (medium: string | undefined) => Promise<string | null>;
  /** Shown at the left of the buttons (a Back button, for instance). */
  leading?: ReactNode;
}

/**
 * Say what you study: a main goal chosen by stepping through dropdowns, the language you study in, and up to three
 * more goals (a Class 12 student who is also preparing for JEE). Used by onboarding and by "My studies"; the same
 * questions as onboarding in Vidyaverse's other apps (docs/learning-path.md there).
 */
export function LearningPathEditor({ initial = [], initialMedium = null, submitLabel, onSubmit, onSkip, leading }: Props) {
  const initialPrimary = initial.find((g) => g.isPrimary) ?? initial[0];
  const [primary, setPrimary] = useState<GoalSelection | null>(null);
  const [extras, setExtras] = useState<Extra[]>(
    initial.filter((g) => g !== initialPrimary).map((g) => ({ id: g.nodeId, name: g.name, path: g.path })),
  );
  const [addingExtra, setAddingExtra] = useState(false);
  const [medium, setMedium] = useState<string | null>(initialMedium);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const room = MAX_GOALS - 1 - extras.length;
  const picked = new Set([...(primary ? [primary.node.id] : []), ...extras.map((e) => e.id)]);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const failure = await action();
    if (failure) setError(failure);
    setBusy(false);
  };

  const save = () =>
    primary &&
    run(() =>
      onSubmit([
        { nodeId: primary.node.id, isPrimary: true, combinationCode: primary.streamCode },
        ...extras.filter((e) => e.id !== primary.node.id).map((e) => ({ nodeId: e.id })),
      ], medium ?? undefined),
    );

  return (
    <div className="space-y-6">
      <LearningGoalSelector
        onChange={setPrimary}
        initialNodeId={initialPrimary?.nodeId}
        initialStreamCode={initialPrimary?.combination?.code ?? null}
        disabled={busy}
      />

      <fieldset className="space-y-2 border-t border-border pt-4">
        <legend className="text-[13px] font-semibold text-muted-foreground">Which language do you study in?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Study medium">
          {MEDIUMS.map((m) => (
            <button
              key={m.code}
              type="button"
              role="radio"
              aria-checked={medium === m.code}
              onClick={() => setMedium(m.code)}
              disabled={busy}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                medium === m.code
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-[13px] font-semibold text-muted-foreground">
          Also studying or preparing for something else? <span className="font-normal text-muted-foreground">(optional, up to {MAX_GOALS - 1})</span>
        </p>
        {extras.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {extras.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-full border border-border bg-muted py-1 pl-3 pr-1.5 text-xs font-medium text-foreground">
                <span className="max-w-[240px] truncate" title={e.path}>
                  {e.name}
                </span>
                <button
                  type="button"
                  onClick={() => setExtras((x) => x.filter((y) => y.id !== e.id))}
                  aria-label={`Remove ${e.name}`}
                  className="relative rounded-full p-0.5 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:bg-black/10"
                  disabled={busy}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {room > 0 &&
          (addingExtra ? (
            <TaxonomyPicker
              pickedIds={picked}
              selectableTypes={GOAL_TYPES}
              maxHeightClass="max-h-56"
              disabled={busy}
              onPick={(n) => {
                setExtras((x) => [...x, { id: n.id, name: n.name, path: n.path }]);
                setAddingExtra(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingExtra(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add another
            </button>
          ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {leading}
          {onSkip && (
            <Button variant="ghost" onClick={() => void run(() => onSkip(medium ?? undefined))} disabled={busy}>
              I&apos;m just exploring
            </Button>
          )}
        </div>
        <Button size="lg" onClick={() => void save()} disabled={busy || !primary}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
