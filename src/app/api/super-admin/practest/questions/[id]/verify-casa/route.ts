// src/app/api/super-admin/practest/questions/[id]/verify-casa/route.ts
//
// CASA verification (the anti-hallucination guarantee): semantically checks that
// the question's KEYED ANSWER actually derives from the NCERT corpus, by searching
// the same Qdrant store the AI tutor cites. If a strongly-matching source chunk is
// found, the question is marked casa_verified and the matched chunk id is captured
// as the (edition-resilient) anchor.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestQuestionBank as Q } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { qdrantSearch } from '@/lib/ai/rag/qdrant-search'

const THRESHOLD = Number(process.env.CASA_VERIFY_THRESHOLD ?? '0.45')

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  try {
    const [q] = await db.select().from(Q).where(eq(Q.id, params.id)).limit(1)
    if (!q) return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 })

    // Build the "claim" to verify: the question + its keyed answer + the explanation.
    const opts: Record<string, string | null> = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    const correctText = (q.correctOption ? opts[q.correctOption] : null) ?? q.modelAnswer ?? ''
    const claim = [q.questionText, correctText, q.explanation].filter(Boolean).join('\n').trim()
    if (!claim) {
      return NextResponse.json({ success: false, error: 'Question has no content to verify' }, { status: 400 })
    }

    // Search the SAME corpus the AI tutor cites. super_admin → whole corpus (global NCERT + all orgs).
    let top: { id: string | number; content: string; score: number; metadata?: { page?: number; chapter?: string } } | null = null
    try {
      const resp = await qdrantSearch.search(claim, {
        subject: q.subject ?? undefined,
        classLevel: q.classLevel != null ? String(q.classLevel) : undefined,
        board: q.board ?? undefined,
        organizationId: null,
        topK: 5,
      })
      top = resp.results?.[0] ?? null
    } catch (e) {
      console.error('[verify-casa] corpus search failed:', e)
      return NextResponse.json(
        { success: false, error: 'Corpus search unavailable (check Qdrant / embeddings configuration)' },
        { status: 503 }
      )
    }

    const score = top?.score ?? 0
    const verified = !!top && score >= THRESHOLD

    await db.update(Q)
      .set({
        casaVerified: verified,
        // Capture the matched chunk as the anchor if one isn't set yet (edition-resilient locator).
        ...(verified && top && !q.casaAnchor ? { casaAnchor: String(top.id) } : {}),
      })
      .where(eq(Q.id, params.id))

    return NextResponse.json({
      success: true,
      verified,
      score: Math.round(score * 1000) / 1000,
      threshold: THRESHOLD,
      matched: top
        ? {
            id: String(top.id),
            page: top.metadata?.page ?? null,
            chapter: top.metadata?.chapter ?? null,
            snippet: (top.content ?? '').slice(0, 320),
          }
        : null,
      message: verified
        ? 'Verified — the keyed answer is supported by the NCERT corpus.'
        : top
          ? `Not verified — best corpus match scored ${Math.round(score * 1000) / 1000} (below ${THRESHOLD}). Review the citation.`
          : 'Not verified — no matching source found in the corpus.',
    })
  } catch (error) {
    console.error('[verify-casa]', error)
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
  }
}
