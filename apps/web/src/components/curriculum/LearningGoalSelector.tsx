'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaxonomyPicker } from '@/components/curriculum/TaxonomyPicker';
import {
  GOAL_TYPES,
  STRUCTURAL_TYPES,
  getClassStreams,
  getTaxonomyChildren,
  getTaxonomyNode,
  type TaxonomyNode,
} from '@/lib/learning-path/client';

export interface GoalSelection {
  node: TaxonomyNode;
  /** The stream chosen for a Class 11-12 goal ("CBSE_SCI_PCM"), when there is one. */
  streamCode: string | null;
}

interface Props {
  /** Called whenever the choice becomes a valid pick (or stops being one). */
  onChange: (selection: GoalSelection | null) => void;
  /** Which kinds of place count as a valid pick. Defaults to somewhere a learner studies (class, programme, exam...). */
  goalTypes?: readonly string[];
  /** Offer only these domains first ("SCH", "HE"...), with a link to show the rest. For an institution of a known kind. */
  rootCodes?: readonly string[];
  /** Ask for a stream after a Class 11-12 pick. Off when describing an institution rather than a learner. */
  showStreams?: boolean;
  /** Label of the first dropdown. */
  rootLabel?: string;
  /** Open with this node already chosen (editing an existing goal). */
  initialNodeId?: string;
  initialStreamCode?: string | null;
  disabled?: boolean;
}

/** What each step is called, depending on where in the taxonomy the person is. */
const SUBDOMAIN_LABEL: Record<string, string> = {
  SCH: 'Board',
  HE: 'Field of study',
  ENT: 'Exam group',
  COMP: 'Exam body',
  SKL: 'Skill area',
  VG: 'Programme area',
  PROF: 'Course',
};
const TYPE_LABEL: Record<string, string> = {
  CLASS: 'Class',
  PROGRAM: 'Programme',
  SPECIALISATION: 'Specialisation',
  PERIOD: 'Year or semester',
  LEVEL: 'Level',
  EXAM: 'Exam',
};

const levelLabelFor = (rootLabel: string) => (options: TaxonomyNode[], chain: TaxonomyNode[], index: number): string => {
  if (index === 0) return rootLabel;
  const first = options[0];
  if (!first) return 'Choose';
  if (first.nodeType === 'SUBDOMAIN') return SUBDOMAIN_LABEL[chain[0]?.code ?? ''] ?? 'Area';
  if (first.nodeType === 'PROGRAM' && chain[0]?.code === 'SKL') return 'Course';
  return TYPE_LABEL[first.nodeType] ?? 'Choice';
};

const structuralOnly = (nodes: TaxonomyNode[]) => nodes.filter((n) => STRUCTURAL_TYPES.includes(n.nodeType));

/**
 * Say what you study by stepping through dropdowns, each filled from the education taxonomy: for school a board,
 * a class and (for Classes 11-12) a stream; for a degree a field, a programme, a specialisation and a year; for an
 * entrance or competitive exam the group and the exam; and so on. A search box finds it by name instead.
 *
 * You can stop at any level that is a place to study (a programme, a class, an exam); going further is optional.
 * Ported from Book Buddy's selector of the same name, reading the learners' curriculum routes.
 */
export function LearningGoalSelector({
  onChange,
  goalTypes = GOAL_TYPES,
  rootCodes,
  showStreams = true,
  rootLabel = 'I am studying',
  initialNodeId,
  initialStreamCode = null,
  disabled,
}: Props) {
  const [chain, setChain] = useState<TaxonomyNode[]>([]);
  const [levels, setLevels] = useState<TaxonomyNode[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<Array<{ code: string; name: string }>>([]);
  const [streamCode, setStreamCode] = useState<string | null>(initialStreamCode);
  const [searching, setSearching] = useState(false);
  const [showAllRoots, setShowAllRoots] = useState(false);
  const seq = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const goalOf = (c: TaxonomyNode[]) => {
    const last = c[c.length - 1];
    return last && goalTypes.includes(last.nodeType) ? last : null;
  };

  /** Loads the streams for a class goal, and reports the choice to the parent. */
  const settle = useCallback(async (c: TaxonomyNode[], stream: string | null, mine: number) => {
    const goal = goalOf(c);
    if (!goal) {
      setStreams([]);
      onChangeRef.current(null);
      return;
    }
    onChangeRef.current({ node: goal, streamCode: stream });
    if (!showStreams || goal.nodeType !== 'CLASS') {
      setStreams([]);
      return;
    }
    const res = await getClassStreams(goal.id);
    if (mine !== seq.current) return;
    setStreams(res.success ? res.data : []);
  }, []);

  /** Rebuilds every dropdown for a chain, so a restored or searched-for choice shows its whole path. */
  const build = useCallback(
    async (target: TaxonomyNode[], stream: string | null) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(null);
      const parents: Array<string | null> = [null, ...target.map((n) => n.id)];
      const results = await Promise.all(parents.map((p, i) => (i <= target.length ? getTaxonomyChildren(p) : Promise.resolve(null))));
      if (mine !== seq.current) return;
      const failed = results.find((r) => r && !r.success);
      if (failed && !failed.success) {
        setError(failed.error);
        setLoading(false);
        return;
      }
      // The first list is the seven domains themselves (not "structural" levels); every list below is.
      const built = results.map((r, i) => (r && r.success ? (i === 0 ? r.data : structuralOnly(r.data)) : [])).filter((o, i) => i === 0 || o.length > 0);
      setChain(target);
      setLevels(built);
      setStreamCode(stream);
      setLoading(false);
      await settle(target, stream, mine);
    },
    [settle],
  );

  const restore = useCallback(
    async (nodeId: string, stream: string | null) => {
      const res = await getTaxonomyNode(nodeId);
      if (!res.success) {
        setError(res.error);
        setLoading(false);
        return;
      }
      await build([...res.data.ancestors, res.data.node], stream);
    },
    [build],
  );

  useEffect(() => {
    if (initialNodeId) void restore(initialNodeId, initialStreamCode);
    else void build([], null);
    // Only on mount: later changes come from the person using the dropdowns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (level: number, nodeId: string) => {
    const node = levels[level]?.find((n) => n.id === nodeId);
    if (!node) return;
    const mine = ++seq.current;
    const nextChain = [...chain.slice(0, level), node];
    setChain(nextChain);
    setStreamCode(null);
    setStreams([]);
    const res = await getTaxonomyChildren(node.id);
    if (mine !== seq.current) return;
    const below = res.success ? structuralOnly(res.data) : [];
    setLevels([...levels.slice(0, level + 1), ...(below.length ? [below] : [])]);
    if (!res.success) setError(res.error);
    await settle(nextChain, null, mine);
  };

  const chooseStream = (code: string) => {
    const value = code === '__none' ? null : code;
    setStreamCode(value);
    const goal = goalOf(chain);
    if (goal) onChangeRef.current({ node: goal, streamCode: value });
  };

  const goal = goalOf(chain);
  const canGoFurther = goal !== null && levels.length > chain.length;
  const levelLabel = levelLabelFor(rootLabel);

  // An institution of a known kind sees the domains that fit it first. With exactly one, it is chosen for them.
  const rootsLimited = !!rootCodes && !showAllRoots;
  const visibleLevels = levels.map((options, i) =>
    i === 0 && rootCodes && !showAllRoots ? options.filter((n) => rootCodes.includes(n.code)) : options,
  );
  const soleRoot = rootsLimited && visibleLevels[0]?.length === 1 ? visibleLevels[0][0] : null;
  const autoPicked = useRef<string | null>(null);
  useEffect(() => {
    if (soleRoot && chain.length === 0 && !loading && autoPicked.current !== soleRoot.id) {
      autoPicked.current = soleRoot.id;
      void choose(0, soleRoot.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soleRoot?.id, chain.length, loading]);

  if (error && levels.length === 0) {
    return (
      <p role="alert" className="text-sm text-destructive">
        The list of courses could not be loaded. {error}{' '}
        <button type="button" className="font-semibold underline" onClick={() => void build([], null)}>
          Try again
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {loading && levels.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        visibleLevels.map((options, i) => (
          <div key={`${i}-${chain[i - 1]?.id ?? 'root'}`} className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-muted-foreground">
              {levelLabel(options, chain, i)}
              {i > 0 && goal && i === chain.length && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
            </Label>
            <Select value={chain[i]?.id ?? ''} onValueChange={(id) => void choose(i, id)} disabled={disabled}>
              <SelectTrigger className="w-full rounded-lg bg-card">
                <SelectValue placeholder={i === 0 ? 'Choose…' : `Choose your ${levelLabel(options, chain, i).toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                    {n.nameHi && <span className="ml-2 text-xs text-muted-foreground">{n.nameHi}</span>}
                    {n.verification === 'template' && <span className="ml-2 text-[10px] uppercase text-muted-foreground">template</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))
      )}

      {showStreams && goal && streams.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold text-muted-foreground">
            Stream <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Select value={streamCode ?? '__none'} onValueChange={chooseStream} disabled={disabled}>
            <SelectTrigger className="w-full rounded-lg bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none">No stream / not sure</SelectItem>
              {streams.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {rootCodes && (
        <button
          type="button"
          onClick={() => setShowAllRoots((v) => !v)}
          className="text-[13px] font-semibold text-primary hover:underline"
          disabled={disabled || chain.length > 0}
          title={chain.length > 0 ? 'Start again to change the area' : undefined}
        >
          {showAllRoots ? 'Show only the usual areas' : 'Show all areas'}
        </button>
      )}
      {canGoFurther && <p className="text-xs text-muted-foreground">You can stop here, or choose a more specific one above.</p>}
      {chain.length > 0 && !goal && <p className="text-xs text-muted-foreground">Keep choosing from the lists above.</p>}

      <div>
        <button
          type="button"
          onClick={() => setSearching((s) => !s)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
          disabled={disabled}
        >
          <Search className="h-3.5 w-3.5" /> {searching ? 'Hide search' : 'Can’t find it? Search by name'}
        </button>
        {searching && (
          <div className="mt-2">
            <TaxonomyPicker
              pickedIds={new Set(goal ? [goal.id] : [])}
              selectableTypes={goalTypes}
              disabled={disabled}
              maxHeightClass="max-h-56"
              onPick={(n) => {
                setSearching(false);
                void restore(n.id, null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
