import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { smartDetectionService } from '@/lib/services/smart-detection-service';
import { executeQuery } from '@/lib/db/connection';
import { NoteRow, SmartDetectionRow } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/smart-detect
 * Run smart detection on note content and save to database
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const { noteId, content } = body;

    if (!noteId || !content) {
      return NextResponse.json(
        { error: 'noteId and content are required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Running smart detection for note: ${noteId}`);

    // Verify note belongs to user
    const noteCheck = await executeQuery<any>(
      'SELECT id, user_id FROM user_notes WHERE id = ?',
      [noteId]
    );

    if (noteCheck.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (noteCheck[0].user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Run detection
    const detections = await smartDetectionService.detectAndEnrich(content);

    // Combine all detections
    const allDetections = [
      ...detections.dates,
      ...detections.formulas,
      ...detections.chemicalEquations,
      ...detections.definitions,
      ...detections.events,
    ];

    console.log(`✅ Found ${allDetections.length} detections`);

    // Delete existing detections for this note
    await executeQuery(
      'DELETE FROM note_smart_detections WHERE note_id = ?',
      [noteId]
    );

    // Save new detections to database
    for (const detection of allDetections) {
      await executeQuery(
        `INSERT INTO note_smart_detections 
         (id, note_id, detection_type, detected_text, parsed_data, position, context_text, suggestions, is_applied)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          noteId,
          detection.type,
          detection.text,
          JSON.stringify(detection.parsedData || {}),
          detection.position,
          detection.context,
          JSON.stringify(detection.suggestions || []),
          false,
        ]
      );
    }

    // Update note to mark as AI processed
    await executeQuery(
      'UPDATE user_notes SET has_smart_detections = ?, ai_processed_at = NOW() WHERE id = ?',
      [allDetections.length > 0, noteId]
    );

    console.log(`✅ Saved ${allDetections.length} detections to database`);

    return NextResponse.json({
      success: true,
      detections: allDetections,
      count: allDetections.length,
      breakdown: {
        dates: detections.dates.length,
        formulas: detections.formulas.length,
        chemicals: detections.chemicalEquations.length,
        definitions: detections.definitions.length,
        events: detections.events.length,
      },
    });
  } catch (error) {
    console.error('❌ Error in smart detection:', error);
    return NextResponse.json(
      {
        error: 'Failed to run smart detection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/smart-detect?noteId=xxx
 * Get existing detections for a note
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    // Verify note belongs to user
    const noteCheck = await executeQuery<NoteRow>(
      'SELECT id, user_id FROM user_notes WHERE id = ?',
      [noteId]
    );

    if (noteCheck.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (noteCheck[0].user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch detections
    const detections = await executeQuery<SmartDetectionRow>(
      `SELECT * FROM note_smart_detections 
       WHERE note_id = ? 
       ORDER BY position ASC`,
      [noteId]
    );

    return NextResponse.json({
      success: true,
      detections,
      count: detections.length,
    });
  } catch (error) {
    console.error('❌ Error fetching detections:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch detections',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

