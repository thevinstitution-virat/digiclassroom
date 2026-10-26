/**
 * The tutor's retrieval over the library hub: what `QdrantRAGSearch.search` does when LIBRARY_HUB_ENABLED is on.
 *
 * It keeps the shapes the tutor already consumes (`QdrantSearchResponse`) and adds what the hub knows: the
 * `passage_id` (stored with citations), the work, the printed page and the PDF page. Scope comes from the caller
 * (the learner's learning path) or, failing that, the class code of the old board and class options. Without
 * either there is nothing to scope a search by and the answer is empty, with the reason in `debugInfo`, never a
 * search over every book.
 */
import type { QdrantSearchOptions, QdrantSearchResponse, QdrantSearchResult } from '../ai/rag/qdrant-search';
import type { HubPassage, HubResult, HubSearchResponse } from './hub-client';
import { resolveScope } from './scope';
import { searchLibrary, type SearchDeps } from './search';

const gradeOf = (classLevel: string | undefined): number | null => {
  const m = classLevel ? /(\d{1,2})/.exec(classLevel) : null;
  return m ? Number(m[1]) : null;
};

const contentTypeOf = (r: HubResult): string => {
  if (r.kind === 'summary') return 'summary';
  if (r.retrieval_class === 'practice') return 'practice';
  if (r.kind === 'block') return (r.block_type ?? 'block').toLowerCase();
  return 'text';
};

/** The hit's words with its neighbouring prose of the same section on each side, in reading order. */
export const withContext = (r: HubResult): string => {
  const text = (ps: HubPassage[]) => ps.map((p) => p.text);
  return [...text(r.context.before), r.text, ...text(r.context.after)].join('\n\n');
};

export function toQdrantResponse(hub: HubSearchResponse, options: QdrantSearchOptions, startedAt: number): QdrantSearchResponse {
  const results: QdrantSearchResult[] = hub.results.map((r) => ({
    id: r.passage_id,
    content: withContext(r),
    // Dense cosine when the hub has it (what R_min means); the fused rank score otherwise.
    score: r.score.dense ?? r.score.fused,
    metadata: {
      class: options.classLevel ?? '',
      subject: options.subject ?? '',
      chapter: `Chapter ${r.chapter_no}`,
      section_title: r.section_title ?? undefined,
      content_type: contentTypeOf(r),
      page: r.page_start,
      contains_equation: false,
      contains_table: r.block_type === 'TABLE',
      contains_figure: r.block_type === 'FIGURE',
      section_level: 3,
      word_count: r.text.split(/\s+/).filter(Boolean).length,
      passage_id: r.passage_id,
      work_id: r.work_id,
      source: r.work_title || undefined,
      pdf_page: r.pdf_page,
      label: r.label,
      page_end: r.page_end,
    },
  }));
  return {
    success: true,
    results,
    total_found: results.length,
    totalResults: results.length,
    search_strategy: hub.degraded ? 'library_direct_degraded' : 'library_hub',
    searchMethod: hub.degraded ? 'library_direct_degraded' : 'library_hub',
    processing_time: Date.now() - startedAt,
    processingTime: Date.now() - startedAt,
    debug_info: { warnings: hub.warnings, degraded: hub.degraded === true, scope: hub.scope },
    debugInfo: { warnings: hub.warnings, degraded: hub.degraded === true, scope: hub.scope },
  };
}

export async function searchViaLibraryHub(query: string, options: QdrantSearchOptions, deps: SearchDeps = {}): Promise<QdrantSearchResponse> {
  const startedAt = Date.now();
  const scope = options.hubScope ?? resolveScope({ board: options.board, grade: gradeOf(options.classLevel), medium: options.medium });
  if (!scope) {
    console.warn('[library] no learner goals and no known board/class: nothing to scope the search by, returning no passages');
    const debug = { reason: 'no_scope' };
    return { success: true, results: [], total_found: 0, totalResults: 0, search_strategy: 'library_hub', searchMethod: 'library_hub', processing_time: 0, processingTime: 0, debug_info: debug, debugInfo: debug };
  }
  const hub = await searchLibrary(
    {
      query,
      ...scope,
      limit: options.topK ?? 5,
      window: 1,
      // The tutor explains from the book's text; exercises and in-text questions are for the evaluator.
      includePractice: options.contentTypes?.includes('practice_problems') ?? false,
    },
    deps,
  );
  return toQdrantResponse(hub, options, startedAt);
}
