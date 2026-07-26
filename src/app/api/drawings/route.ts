/**
 * Drawing Canvas API
 * 
 * Endpoints:
 * - GET /api/drawings?noteId=xxx - Get all drawings for a note
 * - POST /api/drawings - Save a new drawing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/drawings?noteId=xxx
 * Get all drawings for a note
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'Note ID is required' },
        { status: 400 }
      );
    }

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

    // Get drawings
    const drawings = await executeQuery(
      `SELECT 
        id, note_id, drawing_data_url, ocr_text, created_at, updated_at
       FROM note_drawings
       WHERE note_id = ?
       ORDER BY created_at DESC`,
      [noteId]
    );

    return NextResponse.json({
      success: true,
      data: {
        drawings: Array.isArray(drawings) ? drawings : [],
        count: Array.isArray(drawings) ? drawings.length : 0,
      },
    });

  } catch (error) {
    console.error('❌ Get drawings error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drawings
 * Save a new drawing
 */
export async function POST(request: NextRequest) {
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
    const { noteId, imageData, ocrText } = body;

    if (!noteId || !imageData) {
      return NextResponse.json(
        { success: false, error: 'Note ID and image data are required' },
        { status: 400 }
      );
    }

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

    // Save image to file system
    const drawingId = uuidv4();
    const fileName = `${drawingId}.png`;
    const filePath = join(process.cwd(), 'public', 'uploads', 'drawings', fileName);
    
    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    await writeFile(filePath, buffer);

    const drawingUrl = `/uploads/drawings/${fileName}`;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Save to database
    await executeUpdate(
      `INSERT INTO note_drawings (
        id, note_id, drawing_data_url, ocr_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [drawingId, noteId, drawingUrl, ocrText || null, now, now]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: drawingId,
        drawingUrl,
        ocrText,
      },
    });

  } catch (error) {
    console.error('❌ Save drawing error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

