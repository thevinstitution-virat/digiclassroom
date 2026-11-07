// A stand-in for the library hub's search (`POST /api/hub/search`) over a book exported to a JSON file, so the answer-key service and the
// evaluation scripts can be run against real textbook text on a development machine that has no hub and no Qdrant. EVALUATION USE ONLY.
//
// It answers the same request and response shapes as the real hub (lib/library/hub-client.ts) and applies the same scope rules the key
// service relies on: medium, work ids, curriculum node codes (here: the one book's class and subject), reference vs practice rows, and a
// dense cosine in `score.dense` (OpenAI text-embedding-3-large, as the library's own index). Embeddings are cached beside the book.
//
//   export:  psql … -At -c "select json_agg(row_to_json(t) order by t.chunk_order) from (select p.passage_id::text as passage_id, p.chapter_no,
//            p.kind, p.block_type, p.label, p.section_no::text as section_no, p.section_title, p.page_start, p.page_end, p.text,
//            p.retrieval_class, p.chunk_order, w.id::text as work_id, w.title as work_title, w.medium from library.passage p
//            join library.work w on w.id = p.work_id) t" > hw-evals/local-hub/work.json
//   serve:   npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local scripts/hw-local-hub.ts \
//              --book hw-evals/local-hub/work.json --scope SCH.CBSE.C9 --subjects SCIENCE,PHYSICS,CHEMISTRY,BIOLOGY [--port 8799]
//   then run the evaluation scripts with LIBRARY_HUB_ENABLED=true LIBRARY_HUB_URL=http://127.0.0.1:8799 LIBRARY_HUB_SECRET=local.
//
// The book files hold copyrighted text: they stay under hw-evals/ (git-ignored) and are never committed or uploaded.

import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

interface Row {
  passage_id: string; chapter_no: number; kind: 'prose' | 'block' | 'summary'; block_type: string | null; label: string | null; section_no: string | null;
  section_title: string | null; page_start: number; page_end: number; text: string; retrieval_class: 'reference' | 'practice'; chunk_order: number;
  work_id: string; work_title: string; medium: string;
}

const EMBED_MODEL = 'text-embedding-3-large';

/** OpenAI directly, or the same model through OpenRouter (--embed-via openrouter): identical vectors, different bill. */
async function embed(texts: string[]): Promise<number[][]> {
  const via = arg('embed-via', process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai')!;
  const key = via === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) throw new Error(`${via === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} is not set`);
  const url = via === 'openrouter' ? 'https://openrouter.ai/api/v1/embeddings' : 'https://api.openai.com/v1/embeddings';
  const model = via === 'openrouter' ? `openai/${EMBED_MODEL}` : EMBED_MODEL;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: texts.slice(i, i + 64).map((t) => t.slice(0, 8000)) }),
    });
    if (!res.ok) throw new Error(`embeddings via ${via} answered ${res.status}`);
    const body = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    for (const d of body.data.sort((x, y) => x.index - y.index)) out.push(d.embedding);
  }
  return out;
}

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const norm = (a: number[]) => Math.sqrt(dot(a, a));
const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));

async function main() {
  const bookFile = arg('book', 'hw-evals/local-hub/work.json')!;
  const rows = JSON.parse(readFileSync(bookFile, 'utf8')) as Row[];
  const scope = arg('scope', 'SCH.CBSE.C9')!.toUpperCase();
  const subjects = (arg('subjects', 'SCIENCE') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const port = Number(arg('port', '8799'));
  const cacheFile = bookFile.replace(/\.json$/, '.embeddings.json');

  let vectors: number[][];
  if (existsSync(cacheFile)) vectors = JSON.parse(readFileSync(cacheFile, 'utf8'));
  else {
    vectors = await embed(rows.map((r) => r.text));
    writeFileSync(cacheFile, JSON.stringify(vectors));
    console.log(`embedded ${rows.length} passages (${EMBED_MODEL})`);
  }
  const queryCache = new Map<string, number[]>();
  const nodeCodeOk = (codes: string[]) => codes.some((c) => { const u = c.toUpperCase(); return u.startsWith(`${scope}.`) && subjects.some((s) => u.endsWith(`.${s}`)); });

  const server = createServer(async (req, res) => {
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      if (req.method !== 'POST' || req.url !== '/api/hub/search') return send(404, { error: 'not found' });
      if (req.headers['x-hub-secret'] !== (process.env.LIBRARY_HUB_SECRET ?? 'local')) return send(401, { error: 'unauthorized' });
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const q = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { query: string; nodeIds?: string[]; nodeCodes?: string[]; workIds?: string[]; medium?: 'en' | 'hi'; limit?: number; includePractice?: boolean; minDense?: number | null };
      if (!q.query || (!q.nodeIds?.length && !q.nodeCodes?.length && !q.workIds?.length)) return send(400, { error: 'a scope is required' });

      const mediumOk = (m: string) => !q.medium || q.medium === m;
      const scopeOk = q.workIds?.length ? (w: string) => q.workIds!.includes(w) : () => nodeCodeOk(q.nodeCodes ?? []);
      const inScope = rows.map((r, i) => ({ r, i })).filter(({ r }) => mediumOk(r.medium) && scopeOk(r.work_id));
      if (!inScope.length) return send(200, { scope: [], results: [], warnings: ['no book matches this scope'] });

      let qv = queryCache.get(q.query);
      if (!qv) { qv = (await embed([q.query]))[0]; queryCache.set(q.query, qv); }
      const wanted = (c: Row['retrieval_class']) => c === 'reference' || (q.includePractice === true && c === 'practice');
      const hits = inScope.filter(({ r }) => wanted(r.retrieval_class))
        .map(({ r, i }) => ({ r, dense: cosine(qv!, vectors[i]) }))
        .filter((h) => q.minDense == null || h.dense >= q.minDense)
        .sort((a, b) => b.dense - a.dense).slice(0, Math.min(q.limit ?? 10, 20));
      const first = inScope[0].r;
      send(200, {
        scope: [{ work_id: first.work_id, title: first.work_title, medium: first.medium, chapters: null, via: q.nodeCodes ?? [] }],
        warnings: [],
        results: hits.map(({ r, dense }) => ({
          passage_id: r.passage_id, chapter_no: r.chapter_no, kind: r.kind, block_type: r.block_type, label: r.label, section_no: r.section_no, section_title: r.section_title,
          page_start: r.page_start, page_end: r.page_end, pdf_page: null, text: r.text, work_id: r.work_id, work_title: r.work_title, retrieval_class: r.retrieval_class,
          score: { fused: dense, dense }, context: { before: [], after: [] },
        })),
      });
    } catch (e) {
      send(500, { error: e instanceof Error ? e.message : String(e) });
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`local hub on http://127.0.0.1:${port}: ${rows.length} passages, scope ${scope} ${subjects.join('/')} (evaluation use only)`));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
