'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Home, Info, Loader2, Plus, Search, X } from 'lucide-react';
import { NODE_TYPE_LABEL, VERIFICATION_HINT } from '@/lib/taxonomy/curriculum-labels';
import { getTaxonomyChildren, searchTaxonomy, type TaxonomyNode } from '@/lib/learning-path/client';

interface TaxonomyPickerProps {
  /** Ids already chosen: their rows show a tick instead of the add button. */
  pickedIds: ReadonlySet<string>;
  /** Called when a row's add button is pressed. */
  onPick: (node: TaxonomyNode) => void;
  /** Which kinds of node can be chosen (others can only be opened). Omit to allow everything below a domain. */
  selectableTypes?: readonly string[];
  disabled?: boolean;
  /** Height of the list area. */
  maxHeightClass?: string;
}

/**
 * Browse the education taxonomy (curriculum v2) level by level (domain, board, class, subject, unit...) or search
 * it by name in English or Hindi. Ported from Book Buddy's picker of the same name (via PDLMS), for learners.
 */
export function TaxonomyPicker({ pickedIds, onPick, selectableTypes, disabled, maxHeightClass = 'max-h-64' }: TaxonomyPickerProps) {
  const [trail, setTrail] = useState<TaxonomyNode[]>([]);
  const [items, setItems] = useState<TaxonomyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaxonomyNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const loadId = useRef(0);
  const searchId = useRef(0);

  const parent = trail.length ? trail[trail.length - 1] : null;

  const load = useCallback(async () => {
    const id = ++loadId.current;
    setLoading(true);
    setError(null);
    const res = await getTaxonomyChildren(parent?.id ?? null);
    if (id !== loadId.current) return;
    if (res.success) setItems(res.data);
    else {
      setItems([]);
      setError(res.error);
    }
    setLoading(false);
  }, [parent?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Search as the person types, after a short pause; a newer search replaces an older one.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++searchId.current;
    const timer = setTimeout(async () => {
      const res = await searchTaxonomy(q, { types: selectableTypes ? [...selectableTypes] : undefined, limit: 20 });
      if (id !== searchId.current) return;
      setResults(res.success ? res.data : []);
      if (!res.success) setError(res.error);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selectableTypes]);

  // A whole domain is never something to tag with or describe by; it can only be opened.
  const canPick = (n: TaxonomyNode) => n.nodeType !== 'DOMAIN' && (!selectableTypes || selectableTypes.includes(n.nodeType));
  const showing = results ?? items;
  const searchMode = results !== null;

  const open = (n: TaxonomyNode) => {
    setQuery('');
    setResults(null);
    setTrail((t) => [...t, n]);
  };

  const row = (n: TaxonomyNode) => {
    const picked = pickedIds.has(n.id);
    const drillable = n.hasChildren && !searchMode;
    return (
      <li key={n.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
        <button
          type="button"
          disabled={disabled || !drillable}
          onClick={() => drillable && open(n)}
          className={`flex-1 min-w-0 text-left ${drillable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className="block text-sm font-medium text-foreground truncate">
            {n.name}
            {n.nameHi && <span className="ml-2 text-xs font-normal text-muted-foreground">{n.nameHi}</span>}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <span className="uppercase tracking-wide">{NODE_TYPE_LABEL[n.nodeType] ?? n.nodeType}</span>
            {searchMode && <span className="truncate">· {n.path}</span>}
            {n.verification !== 'sourced' && (
              <span title={VERIFICATION_HINT[n.verification]} className="inline-flex items-center gap-0.5 rounded px-1 bg-muted text-muted-foreground">
                <Info className="w-3 h-3" /> {n.verification === 'template' ? 'template' : 'verify'}
              </span>
            )}
          </span>
        </button>
        {canPick(n) &&
          (picked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary shrink-0">
              <Check className="w-3.5 h-3.5" /> Added
            </span>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(n)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          ))}
        {drillable && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />}
      </li>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Search a board, class, subject, exam or course…"
          aria-label="Search the education taxonomy"
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="p-0.5 rounded-full hover:bg-black/10">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {!searchMode && (
        <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
          <button type="button" onClick={() => setTrail([])} className="inline-flex items-center gap-1 hover:text-primary font-medium" disabled={disabled}>
            <Home className="w-3 h-3" /> All
          </button>
          {trail.map((n, i) => (
            <span key={n.id} className="inline-flex items-center gap-1">
              <ChevronRight className="w-3 h-3" aria-hidden />
              <button type="button" onClick={() => setTrail(trail.slice(0, i + 1))} className="hover:text-primary font-medium truncate max-w-[10rem]" disabled={disabled}>
                {n.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      <div className={`${maxHeightClass} overflow-y-auto`}>
        {error ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="flex-1">The taxonomy could not be loaded. {error}</span>
            <button type="button" onClick={() => void load()} className="text-xs font-medium text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : loading && !searchMode ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : showing.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {searchMode ? 'Nothing matches that. Try a shorter word.' : 'Nothing further down here.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">{showing.map(row)}</ul>
        )}
      </div>
    </div>
  );
}
