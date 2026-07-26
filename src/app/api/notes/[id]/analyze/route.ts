/**
 * Note Analysis API - Batched AI Operations
 * 
 * Purpose: Single endpoint for all AI-powered note analysis
 * Cost Optimization: One API call instead of 3-4 separate calls
 * 
 * Returns:
 * - Auto-generated tags
 * - Summary (2-3 sentences)
 * - Key points (5-7 bullet points)
 * - Flashcard suggestions
 * - Related topics
 * 
 * Caching: Results cached in note_insights table
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import { noteAIService } from '@/lib/services/note-ai-service';
import { aiBatchRateLimiter } from '@/lib/middleware/rate-limiter';

/**
 * POST /api/notes/[id]/analyze
 * Perform comprehensive AI analysis on note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Feature flag check (aiBatchAnalysis flag removed in rewrite; preserve env default OFF)
    if (!(process.env.FEATURE_AI_BATCH_ANALYSIS === 'true' || process.env.FEATURE_AI_BATCH_ANALYSIS === '1')) {
      return NextResponse.json(
        { success: false, error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }
    
    // Rate limiting (stricter for batch operations)
    const rateLimitResponse = await aiBatchRateLimiter(request);
    if (rateLimitResponse)
  return rateLimitResponse;
    
    // Authentication
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const noteId = params.id;
    const body = await request.json();
    const { forceRegenerate = false } = body;
    
    // Get note content and metadata
    const noteResults = await executeQuery(
      `SELECT 
        user_id,
        title,
        content,
        subject,
        chapter,
        board,
        class_level
       FROM user_notes 
       WHERE id = ?`,
      [noteId]
    );
    
    if (!Array.isArray(noteResults) || noteResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    const note = noteResults[0];
    
    // Verify ownership
    if (note.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Validate content
    if (!note.content || note.content.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Note content too short for analysis' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Analyzing note ${noteId} (force: ${forceRegenerate})`);
    
    // Check if we should use cache
    if (!forceRegenerate) {
      const hasChanged = await noteAIService.hasContentChangedSignificantly(
        noteId,
        note.content
      );
      
      if (!hasChanged) {
        console.log(`✅ Content unchanged, using cached analysis`);
      }
    }
    
    // Perform analysis (will use cache if available and content unchanged)
    const analysis = await noteAIService.analyzeNote(
      noteId,
      note.content,
      {
        subject: note.subject,
        chapter: note.chapter,
        board: note.board,
        classLevel: note.class_level,
      }
    );
    
    // Optionally auto-apply tags to note
    const { autoApplyTags = false } = body;
    if (autoApplyTags && analysis.tags.length > 0) {
      await executeQuery(
        `UPDATE user_notes 
         SET tags = ?, updated_at = NOW() 
         WHERE id = ?`,
        [JSON.stringify(analysis.tags), noteId]
      );
      console.log(`✅ Auto-applied ${analysis.tags.length} tags to note`);
    }
    
    console.log(`✅ Analysis complete for note ${noteId}`);
    
    return NextResponse.json({
      success: true,
      data: {
        noteId,
        analysis: {
          tags: analysis.tags,
          summary: analysis.summary,
          keyPoints: analysis.keyPoints,
          flashcardSuggestions: analysis.flashcards,
          relatedTopics: analysis.relatedTopics,
        },
        metadata: {
          confidence: analysis.confidence,
          tokensUsed: analysis.tokensUsed,
          cached: !forceRegenerate,
        },
      },
      message: 'Note analyzed successfully',
    });
    
  } catch (error) {
    console.error('❌ Note analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notes/[id]/analyze
 * Get cached analysis if available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const noteId = params.id;
    
    // Verify note ownership
    const noteResults = await executeQuery(
      'SELECT user_id FROM user_notes WHERE id = ?',
      [noteId]
    );
    
    if (!Array.isArray(noteResults) || noteResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    if (noteResults[0].user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Get cached analysis
    const insights = await executeQuery(
      `SELECT 
        insight_type,
        content,
        confidence_score,
        tokens_used,
        generated_at,
        is_valid
       FROM note_insights
       WHERE note_id = ? AND is_valid = TRUE
       ORDER BY generated_at DESC`,
      [noteId]
    );
    
    if (!Array.isArray(insights) || insights.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          noteId,
          hasAnalysis: false,
          message: 'No analysis available. Run POST /api/notes/[id]/analyze to generate.',
        },
      });
    }
    
    // Parse insights
    const analysisData: any = {};
    let totalTokens = 0;
    let latestTimestamp = null;
    
    for (const insight of insights) {
      if (insight.insight_type === 'batch_analysis') {
        const parsed = JSON.parse(insight.content);
        analysisData.tags = parsed.tags;
        analysisData.summary = parsed.summary;
        analysisData.keyPoints = parsed.keyPoints;
        analysisData.flashcardSuggestions = parsed.flashcards;
        analysisData.relatedTopics = parsed.relatedTopics;
        totalTokens += insight.tokens_used || 0;
        latestTimestamp = insight.generated_at;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        noteId,
        hasAnalysis: Object.keys(analysisData).length > 0,
        analysis: analysisData,
        metadata: {
          generatedAt: latestTimestamp,
          tokensUsed: totalTokens,
          cached: true,
        },
      },
    });
    
  } catch (error) {
    console.error('❌ Get analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

