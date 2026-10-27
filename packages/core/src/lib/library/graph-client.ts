/**
 * The library's knowledge graph, as the tutor and the evaluator read it (PDLMS `POST /api/hub/graph/expand`): for the
 * passages a search returned, the concepts they teach, what a student needs first, and how the concepts relate, each
 * relation with the book's words and its passage id. LIBRARY_GRAPH_ENABLED turns it on; any failure returns null and
 * the caller answers exactly as before, so the graph can only add to an answer, never block one.
 */
import { hubConfigFromEnv, type HubConfig } from './hub-client';

export interface GraphConcept {
  id: string;
  label: string;
  type: string;
  description: string | null;
  first_chapter: number;
}
export interface GraphPrerequisite {
  id: string;
  label: string;
  first_chapter: number;
  for_concept: string;
  quote: string;
  passage_id: string;
}
export interface GraphRelation {
  source: string;
  relation: string;
  target: string;
  quote: string;
  passage_id: string;
  confidence: number;
}
export interface GraphExpansion {
  concepts: GraphConcept[];
  prerequisites: GraphPrerequisite[];
  relations: GraphRelation[];
}

export const libraryGraphEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  (env.LIBRARY_HUB_ENABLED ?? '').trim().toLowerCase() === 'true' && (env.LIBRARY_GRAPH_ENABLED ?? '').trim().toLowerCase() === 'true';

/** The graph should never slow an answer much: a short timeout of its own, under the search's. */
const GRAPH_TIMEOUT_MS = 2500;

export async function graphExpand(
  workId: string,
  passageIds: string[],
  opts: { cfg?: HubConfig; fetchImpl?: typeof fetch; limit?: number } = {},
): Promise<GraphExpansion | null> {
  if (!workId || !passageIds.length) return null;
  let cfg: HubConfig;
  try {
    cfg = opts.cfg ?? hubConfigFromEnv();
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(cfg.timeoutMs, GRAPH_TIMEOUT_MS));
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${cfg.baseUrl}/api/hub/graph/expand`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-app': cfg.appId, 'x-hub-secret': cfg.secret },
      body: JSON.stringify({ workId, passageIds: passageIds.slice(0, 30), limit: opts.limit ?? 8 }),
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as GraphExpansion | null;
    if (!body || !Array.isArray(body.concepts)) return null;
    return { concepts: body.concepts, prerequisites: body.prerequisites ?? [], relations: body.relations ?? [] };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const RELATION_WORDS: Record<string, string> = {
  part_of: 'is part of', example_of: 'is an example of', formula_of: 'is the formula for', contrasts_with: 'contrasts with',
  causes: 'causes', measured_in: 'is measured in', related_to: 'is related to', prerequisite_of: 'is needed before',
};

/** "[3]" when the passage is one of the numbered excerpts, else where in the book it is ("chapter 2"). */
function citeOf(passageId: string, numbered: Map<string, number>): string {
  const n = numbered.get(passageId);
  if (n) return `[${n}]`;
  const chapter = Number(passageId.split(':')[1]);
  return Number.isInteger(chapter) ? `(textbook, chapter ${chapter})` : '';
}

/**
 * The concept block added after the numbered excerpts: the concepts they teach, what to know first, and the relations
 * between them, each with the book's words and its citation. Empty when the graph has nothing for these passages.
 */
export function formatConceptBlock(g: GraphExpansion | null, excerptPassageIds: string[]): string {
  if (!g || !g.concepts.length) return '';
  const numbered = new Map(excerptPassageIds.map((id, i) => [id, i + 1] as [string, number]).filter(([id]) => !!id));
  const lines: string[] = ['CONCEPT MAP FROM THE TEXTBOOK (use it to connect ideas and to say what to revise first; cite as shown):'];
  lines.push(`Concepts in these excerpts: ${g.concepts.slice(0, 8).map((c) => c.label).join(', ')}.`);
  const pre = g.prerequisites.slice(0, 4);
  if (pre.length) {
    lines.push('Needed first:');
    for (const p of pre) lines.push(`- ${p.label} (chapter ${p.first_chapter}) before ${p.for_concept}: "${p.quote}" ${citeOf(p.passage_id, numbered)}`.trimEnd());
  }
  const rel = g.relations.slice(0, 6);
  if (rel.length) {
    lines.push('How they connect:');
    for (const r of rel) lines.push(`- ${r.source} ${RELATION_WORDS[r.relation] ?? r.relation} ${r.target}: "${r.quote}" ${citeOf(r.passage_id, numbered)}`.trimEnd());
  }
  return lines.join('\n');
}

/** The work most of the excerpts come from: the graph is per work. */
export function mainWork(metadata: Array<Record<string, unknown> | undefined>): string | null {
  const count = new Map<string, number>();
  for (const m of metadata) {
    const w = typeof m?.work_id === 'string' ? m.work_id : null;
    if (w) count.set(w, (count.get(w) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
