'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, Home, Info, Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { NODE_TYPE_LABEL, VERIFICATION_HINT } from '@/lib/taxonomy/curriculum-labels';
import type { CurriculumNode } from '@/lib/taxonomy/curriculum';

function VerificationBadge({ value }: { value: string }) {
  if (value === 'sourced') return null;
  return (
    <span
      title={VERIFICATION_HINT[value]}
      className="inline-flex items-center gap-0.5 rounded px-1 bg-muted text-muted-foreground"
    >
      <Info className="h-3 w-3" /> {value === 'template' ? 'template' : 'verify'}
    </span>
  );
}

function NodeDetails({ node }: { node: CurriculumNode }) {
  const combinations = api.taxonomy.curriculum.combinations.useQuery(
    { id: node.id },
    { enabled: node.nodeType === 'CLASS' },
  );
  const grade =
    node.gradeFrom === null ? null : node.gradeFrom === node.gradeTo ? `${node.gradeFrom}` : `${node.gradeFrom}–${node.gradeTo}`;
  const facts: Array<[string, string | null]> = [
    ['Code', node.code],
    ['Id', node.id],
    ['Type', NODE_TYPE_LABEL[node.nodeType] ?? node.nodeType],
    ['Subject identity', node.canonicalSubject],
    ['Grade', grade],
    ['Local name', node.localName],
    ['Verification', `${node.verification}${VERIFICATION_HINT[node.verification] ? ` — ${VERIFICATION_HINT[node.verification]}` : ''}`],
    ['Completeness', node.completeness],
  ];
  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold">
          {node.name}
          {node.nameHi && <span className="ml-2 text-xs font-normal text-muted-foreground">{node.nameHi}</span>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{node.path}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono break-all">{v}</dd>
              </div>
            ))}
        </dl>
        {node.nodeType === 'CLASS' && (
          <div>
            <p className="text-xs font-medium mb-1">Streams</p>
            {combinations.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : combinations.data && combinations.data.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {combinations.data.map((c) => (
                  <Badge key={c.code} variant="secondary" className="text-xs font-normal" title={c.code}>
                    {c.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">None for this class.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Curriculum v2 (TAXONOMY_V2_ENABLED): Book Buddy's education taxonomy as Vidyaverse serves it, browsed level by
 * level or searched in English or Hindi, the way Book Buddy's TaxonomyPicker does. Read-only: the taxonomy changes
 * by a new release, not from here.
 */
export function CurriculumBrowser() {
  const [trail, setTrail] = useState<CurriculumNode[]>([]);
  const [selected, setSelected] = useState<CurriculumNode | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const parent = trail.length ? trail[trail.length - 1] : null;
  const children = api.taxonomy.curriculum.children.useQuery({ parentId: parent?.id ?? null });
  const searchMode = debounced.length >= 2;
  const search = api.taxonomy.curriculum.search.useQuery({ q: debounced }, { enabled: searchMode });

  const listing = searchMode ? search : children;
  const showing = listing.data ?? [];

  function open(n: CurriculumNode) {
    setQuery('');
    setDebounced('');
    setTrail((t) => [...t, n]);
    setSelected(n);
  }

  function row(n: CurriculumNode) {
    const drillable = n.hasChildren && !searchMode;
    return (
      <li
        key={n.id}
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
          selected?.id === n.id ? 'bg-primary/10' : 'hover:bg-muted/60',
        )}
        onClick={() => (drillable ? open(n) : setSelected(n))}
      >
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">
            {n.name}
            {n.nameHi && <span className="ml-2 text-xs font-normal text-muted-foreground">{n.nameHi}</span>}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <span className="uppercase tracking-wide">{NODE_TYPE_LABEL[n.nodeType] ?? n.nodeType}</span>
            {searchMode && <span className="truncate">· {n.path}</span>}
            <VerificationBadge value={n.verification} />
          </span>
        </div>
        {drillable && <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" aria-hidden />}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a board, class, subject, exam or course…"
            aria-label="Search the education taxonomy"
            className="h-7 border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
          />
          {query && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setQuery('')} aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          {searchMode && search.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {!searchMode && (
          <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground border-b">
            <button type="button" onClick={() => { setTrail([]); setSelected(null); }} className="inline-flex items-center gap-1 hover:text-foreground font-medium">
              <Home className="h-3 w-3" /> All
            </button>
            {trail.map((n, i) => (
              <span key={n.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3" aria-hidden />
                <button
                  type="button"
                  onClick={() => { setTrail(trail.slice(0, i + 1)); setSelected(n); }}
                  className="hover:text-foreground font-medium truncate max-w-[10rem]"
                >
                  {n.name}
                </button>
              </span>
            ))}
          </nav>
        )}

        <div className="max-h-[28rem] overflow-y-auto">
          {listing.error ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="flex-1">The taxonomy could not be loaded. {listing.error.message}</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void listing.refetch()}>
                Try again
              </Button>
            </div>
          ) : listing.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : showing.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {searchMode ? 'Nothing matches that. Try a shorter word.' : 'Nothing further down here.'}
            </p>
          ) : (
            <ul className="divide-y">{showing.map(row)}</ul>
          )}
        </div>
      </Card>

      {selected && <NodeDetails node={selected} />}
    </div>
  );
}
