/**
 * Flashcard Generation API
 * 
 * Endpoints:
 * - GET /api/notes/[id]/flashcards - Get all flashcards for a note
 * - POST /api/notes/[id]/flashcards - Generate flashcards from note content
 * - DELETE /api/notes/[id]/flashcards/[flashcardId] - Delete a flashcard
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import { noteAIService } from '@/lib/services/note-ai-service';
import { aiRateLimiter } from '@/lib/middleware/rate-limiter';

/**
 * GET /api/notes/[id]/flashcards
 * Get all flashcards for a note
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    
    // Get flashcards
    const flashcards = await executeQuery(
      `SELECT 
        id,
        question,
        answer,
        card_type,
        difficulty_level,
        auto_generated,
        generation_confidence,
        is_active,
        user_rating,
        spaced_repetition_card_id,
        created_at,
        updated_at
       FROM note_flashcards
       WHERE note_id = ? AND is_active = TRUE
       ORDER BY created_at DESC`,
      [noteId]
    );
    
    return NextResponse.json({
      success: true,
      data: {
        noteId,
        flashcards: Array.isArray(flashcards) ? flashcards : [],
        count: Array.isArray(flashcards) ? flashcards.length : 0,
      },
    });
    
  } catch (error) {
    console.error('❌ Get flashcards error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes/[id]/flashcards
 * Generate flashcards from note content
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Feature flag check (autoFlashcardGeneration flag removed in rewrite; preserve env default = dev-on)
    if (!(process.env.FEATURE_AUTO_FLASHCARDS !== undefined
            ? (process.env.FEATURE_AUTO_FLASHCARDS === 'true' || process.env.FEATURE_AUTO_FLASHCARDS === '1')
            : process.env.NODE_ENV === 'development')) {
      return NextResponse.json(
        { success: false, error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }
    
    // Rate limiting
    const rateLimitResponse = await aiRateLimiter(request);
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
    const { count = 10, regenerate = false } = body;
    
    // Validate count
    if (count < 1 || count > 20) {
      return NextResponse.json(
        { success: false, error: 'Count must be between 1 and 20' },
        { status: 400 }
      );
    }
    
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
    
    // Check if flashcards already exist
    if (!regenerate) {
      const existingFlashcards = await executeQuery(
        'SELECT COUNT(*) as count FROM note_flashcards WHERE note_id = ? AND is_active = TRUE',
        [noteId]
      );
      
      if (Array.isArray(existingFlashcards) && existingFlashcards[0].count > 0) {
        return NextResponse.json({
          success: false,
          error: 'Flashcards already exist. Set regenerate=true to regenerate.',
          code: 'FLASHCARDS_EXIST',
          existingCount: existingFlashcards[0].count,
        }, { status: 409 });
      }
    }
    
    // Validate content length
    if (!note.content || note.content.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Note content too short to generate flashcards' },
        { status: 400 }
      );
    }
    
    console.log(`🎴 Generating ${count} flashcards for note ${noteId}`);
    
    // Generate flashcards using AI
    const flashcards = await noteAIService.generateFlashcardsOnly(
      note.content,
      {
        subject: note.subject,
        chapter: note.chapter,
        board: note.board,
        classLevel: note.class_level,
      },
      count
    );
    
    if (flashcards.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate flashcards' },
        { status: 500 }
      );
    }
    
    // If regenerating, deactivate old flashcards
    if (regenerate) {
      await executeQuery(
        'UPDATE note_flashcards SET is_active = FALSE WHERE note_id = ?',
        [noteId]
      );
    }
    
    // Save flashcards to database
    const flashcardIds = await noteAIService.saveFlashcards(
      noteId,
      userId,
      flashcards
    );
    
    console.log(`✅ Generated ${flashcards.length} flashcards for note ${noteId}`);
    
    return NextResponse.json({
      success: true,
      data: {
        noteId,
        flashcards,
        count: flashcards.length,
        flashcardIds,
      },
      message: `Successfully generated ${flashcards.length} flashcards`,
    });
    
  } catch (error) {
    console.error('❌ Flashcard generation error:', error);
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
 * PUT /api/notes/[id]/flashcards/[flashcardId]
 * Update a flashcard (rating, active status, content)
 */
export async function PUT(
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
    
    const body = await request.json();
    const { flashcardId, rating, isActive, question, answer } = body;
    
    if (!flashcardId) {
      return NextResponse.json(
        { success: false, error: 'Flashcard ID required' },
        { status: 400 }
      );
    }
    
    // Verify ownership
    const flashcardResults = await executeQuery(
      `SELECT nf.id 
       FROM note_flashcards nf
       JOIN user_notes un ON nf.note_id = un.id
       WHERE nf.id = ? AND un.user_id = ?`,
      [flashcardId, userId]
    );
    
    if (!Array.isArray(flashcardResults) || flashcardResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Flashcard not found or forbidden' },
        { status: 404 }
      );
    }
    
    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    
    if (rating !== undefined) {
      updates.push('user_rating = ?');
      values.push(rating);
    }
    
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
    }
    
    if (question !== undefined) {
      updates.push('question = ?');
      values.push(question);
    }
    
    if (answer !== undefined) {
      updates.push('answer = ?');
      values.push(answer);
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }
    
    updates.push('updated_at = NOW()');
    values.push(flashcardId);
    
    await executeQuery(
      `UPDATE note_flashcards SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return NextResponse.json({
      success: true,
      message: 'Flashcard updated successfully',
    });
    
  } catch (error) {
    console.error('❌ Update flashcard error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

