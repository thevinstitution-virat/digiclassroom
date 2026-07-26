/**
 * RAG Regression Test Baseline Runner
 * 
 * Executes all golden queries against the live /api/ai/chat endpoint,
 * collects SSE stream results, and writes a baseline JSON for future diffs.
 *
 * Usage:
 *   pnpm eval:baseline
 *   EVAL_SESSION_COOKIE="better-auth.session_token=..." npx tsx scripts/eval/run-baseline.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoldenQuery {
  id: string;
  bucket: string;
  query: string;
  expectedGrade: string;
  expectedSubject: string;
  expectedBoard: string;
  expectedChapter: string;
  expectedConceptKeywords: string[];
  shouldRetrieveAtLeast: number;
  gradeBoundaryGroup?: string;
  boardPairGroup?: string;
}

interface QueryResult {
  queryId: string;
  bucket: string;
  query: string;
  retrievedChunkCount: number;
  topScore: number;
  retrievedChapters: string[];
  citationCount: number;
  responseLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  answer: string;
  keywordsFound: string[];
  keywordHitRate: number;
  retrievalMet: boolean;
  gradeLeakDetected: boolean;
  error?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000'; // canonical DCP dev port (start-dev.bat)
let SESSION_COOKIE = process.env.EVAL_SESSION_COOKIE || '';
const EVAL_EMAIL = process.env.EVAL_EMAIL || '';
const EVAL_PASSWORD = process.env.EVAL_PASSWORD || '';
const CONCURRENCY = 1; // Sequential to avoid overloading the local dev server
const QUERY_TIMEOUT_MS = 120_000; // 2 min per query

// ─── Auto-Login via better-auth ───────────────────────────────────────────────

async function autoLogin(): Promise<string> {
  console.log(`  🔐 Signing in as ${EVAL_EMAIL}...`);

  const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/sign-in`,
    },
    body: JSON.stringify({ email: EVAL_EMAIL, password: EVAL_PASSWORD }),
    redirect: 'manual', // Capture Set-Cookie before redirect
  });

  // Extract set-cookie header(s)
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length === 0) {
    // Fallback: try raw headers
    const rawCookie = response.headers.get('set-cookie') || '';
    if (!rawCookie) {
      const body = await response.text().catch(() => '');
      throw new Error(`Login failed (HTTP ${response.status}): no cookies returned. Body: ${body.slice(0, 200)}`);
    }
    return rawCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  const cookieStr = setCookies.map(c => c.split(';')[0].trim()).join('; ');
  if (!cookieStr.includes('better-auth')) {
    throw new Error(`Login returned cookies but none are better-auth session cookies: ${cookieStr.slice(0, 200)}`);
  }

  console.log(`  ✅ Signed in successfully.\n`);
  return cookieStr;
}

// ─── SSE Stream Consumer ─────────────────────────────────────────────────────

async function consumeSSEStream(
  query: GoldenQuery
): Promise<QueryResult> {
  const startTime = Date.now();

  const body = {
    message: query.query,
    board: query.expectedBoard,
    classLevel: `Class ${query.expectedGrade}`,
    subject: query.expectedSubject,
    roleContext: {
      menuIntent: 'general_help',
      role: 'student',
    },
    sessionId: `eval-baseline-${query.id}`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return createErrorResult(query, startTime, `HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    if (!response.body) {
      return createErrorResult(query, startTime, 'No response body');
    }

    // Read SSE stream
    let answer = '';
    let sources: any[] = [];
    let routingData: any = null;
    let completeData: any = null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const eventBlocks = buffer.split('\n\n');
      buffer = eventBlocks.pop() ?? '';

      for (const block of eventBlocks) {
        if (!block.trim()) continue;

        const dataLine = block.split('\n').find((line: string) => line.startsWith('data: '));
        if (!dataLine) continue;

        const jsonStr = dataLine.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const chunk = JSON.parse(jsonStr);

          switch (chunk.type) {
            case 'chunk':
              answer += chunk.content || '';
              break;

            case 'routing':
              routingData = chunk;
              break;

            case 'complete':
              completeData = chunk;
              if (chunk.answer) answer = chunk.answer; // Full answer overwrites chunks
              if (chunk.sources?.sources) sources = chunk.sources.sources;
              break;
          }
        } catch {
          // Malformed JSON — skip
        }
      }
    }

    const responseLatencyMs = Date.now() - startTime;

    // Extract metrics from sources
    const retrievedChapters = sources.map((s: any) => s.chapter || 'unknown');
    const topScore = sources.length > 0
      ? Math.max(...sources.map((s: any) => s.confidence || 0))
      : 0;

    // Keyword matching
    const keywordsFound = query.expectedConceptKeywords.filter(k =>
      answer.toLowerCase().includes(k.toLowerCase())
    );
    const keywordHitRate = query.expectedConceptKeywords.length > 0
      ? keywordsFound.length / query.expectedConceptKeywords.length
      : 0;

    // Grade leak detection: check if retrieved chapters contain content from a different grade
    // Simple heuristic: look for "Class X" in chapter metadata where X != expectedGrade
    const gradeLeakDetected = sources.some((s: any) => {
      const chapterClass = s.class || '';
      if (!chapterClass) return false;
      const classNum = chapterClass.replace(/\D/g, '');
      return classNum && classNum !== query.expectedGrade;
    });

    return {
      queryId: query.id,
      bucket: query.bucket,
      query: query.query,
      retrievedChunkCount: sources.length,
      topScore: Math.round(topScore * 1000) / 1000,
      retrievedChapters,
      citationCount: sources.length,
      responseLatencyMs,
      promptTokens: 0, // Not exposed in current SSE — zero until instrumented
      completionTokens: 0,
      totalTokens: 0,
      answer: answer.slice(0, 3000), // Cap storage size
      keywordsFound,
      keywordHitRate: Math.round(keywordHitRate * 1000) / 1000,
      retrievalMet: sources.length >= query.shouldRetrieveAtLeast,
      gradeLeakDetected,
    };
  } catch (err) {
    return createErrorResult(query, startTime, (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}

function createErrorResult(query: GoldenQuery, startTime: number, error: string): QueryResult {
  return {
    queryId: query.id,
    bucket: query.bucket,
    query: query.query,
    retrievedChunkCount: 0,
    topScore: 0,
    retrievedChapters: [],
    citationCount: 0,
    responseLatencyMs: Date.now() - startTime,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    answer: '',
    keywordsFound: [],
    keywordHitRate: 0,
    retrievalMet: false,
    gradeLeakDetected: false,
    error,
  };
}

// ─── Summary Printer ──────────────────────────────────────────────────────────

function printSummary(results: QueryResult[]) {
  const total = results.length;
  const successful = results.filter(r => !r.error);
  const errors = results.filter(r => r.error);

  const avgLatency = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.responseLatencyMs, 0) / successful.length)
    : 0;

  const avgTokens = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.totalTokens, 0) / successful.length)
    : 0;

  const retrievalMet = successful.filter(r => r.retrievalMet).length;
  const avgKeywordHitRate = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.keywordHitRate, 0) / successful.length * 100)
    : 0;

  const gradeLeaks = successful.filter(r => r.gradeLeakDetected).length;

  // Per-bucket breakdown
  const buckets = ['factual', 'conceptual', 'procedural', 'grade_boundary', 'board_specific'];

  console.log('\n' + '═'.repeat(70));
  console.log('  📊 RAG REGRESSION BASELINE — SUMMARY');
  console.log('═'.repeat(70));

  console.log(`\n  Total queries:           ${total}`);
  console.log(`  Successful:              ${successful.length}`);
  console.log(`  Errors:                  ${errors.length}`);
  console.log(`  Avg latency:             ${avgLatency}ms`);
  console.log(`  Avg total tokens:        ${avgTokens}`);
  console.log(`  Retrieval met rate:      ${retrievalMet}/${successful.length}`);
  console.log(`  Avg keyword hit rate:    ${avgKeywordHitRate}%`);
  console.log(`  Grade leaks detected:    ${gradeLeaks}`);

  console.log('\n  ── Per-Bucket Breakdown ──');
  console.log('  ' + '-'.repeat(68));
  console.log(
    `  ${'Bucket'.padEnd(18)} ${'Count'.padStart(5)} ${'AvgLat'.padStart(8)} ${'RetMet'.padStart(8)} ${'KwdHit'.padStart(8)} ${'Leaks'.padStart(6)}`
  );
  console.log('  ' + '-'.repeat(68));

  for (const bucket of buckets) {
    const bucketResults = successful.filter(r => r.bucket === bucket);
    if (bucketResults.length === 0) continue;

    const bAvgLat = Math.round(bucketResults.reduce((s, r) => s + r.responseLatencyMs, 0) / bucketResults.length);
    const bRetMet = bucketResults.filter(r => r.retrievalMet).length;
    const bKwdHit = Math.round(
      bucketResults.reduce((s, r) => s + r.keywordHitRate, 0) / bucketResults.length * 100
    );
    const bLeaks = bucketResults.filter(r => r.gradeLeakDetected).length;

    console.log(
      `  ${bucket.padEnd(18)} ${String(bucketResults.length).padStart(5)} ${(bAvgLat + 'ms').padStart(8)} ${(bRetMet + '/' + bucketResults.length).padStart(8)} ${(bKwdHit + '%').padStart(8)} ${String(bLeaks).padStart(6)}`
    );
  }

  console.log('  ' + '-'.repeat(68));

  if (errors.length > 0) {
    console.log('\n  ── Errors ──');
    for (const e of errors) {
      console.log(`  ❌ ${e.queryId}: ${e.error?.slice(0, 100)}`);
    }
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve authentication
  if (!SESSION_COOKIE && EVAL_EMAIL && EVAL_PASSWORD) {
    try {
      SESSION_COOKIE = await autoLogin();
    } catch (err) {
      console.error(`❌ Auto-login failed: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  if (!SESSION_COOKIE) {
    console.error('❌ Authentication required. Use one of:');
    console.error('   Option 1: EVAL_EMAIL="you@test.com" EVAL_PASSWORD="pass" pnpm eval:baseline');
    console.error('   Option 2: EVAL_SESSION_COOKIE="better-auth.session_token=abc123" pnpm eval:baseline');
    process.exit(1);
  }

  // Load golden queries
  const queriesPath = resolve(__dirname, 'golden-queries.json');
  if (!existsSync(queriesPath)) {
    console.error(`❌ Golden queries not found: ${queriesPath}`);
    process.exit(1);
  }

  const queries: GoldenQuery[] = JSON.parse(readFileSync(queriesPath, 'utf-8'));
  console.log(`\n📋 Loaded ${queries.length} golden queries\n`);

  // Ensure results directory exists
  const resultsDir = resolve(__dirname, '../../results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  // Run queries sequentially
  const results: QueryResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const progress = `[${String(i + 1).padStart(2)}/${queries.length}]`;
    process.stdout.write(`  ${progress} ${q.id} — ${q.query.slice(0, 50).padEnd(50)}... `);

    const result = await consumeSSEStream(q);
    results.push(result);

    if (result.error) {
      console.log(`❌ ${result.error.slice(0, 40)}`);
    } else {
      console.log(
        `✅ ${result.responseLatencyMs}ms | ${result.retrievedChunkCount} chunks | kwd: ${Math.round(result.keywordHitRate * 100)}%`
      );
    }
  }

  // Write results
  const timestamp = new Date().toISOString().slice(0, 10);
  const outputPath = resolve(resultsDir, `baseline-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);

  // Print summary
  printSummary(results);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
