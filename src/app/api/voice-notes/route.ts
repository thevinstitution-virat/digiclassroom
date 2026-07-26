import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * POST /api/voice-notes
 * Upload and save voice recording
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const noteId = formData.get('noteId') as string;
    const duration = parseInt(formData.get('duration') as string) || 0;

    if (!audioFile || !noteId) {
      return NextResponse.json(
        { error: 'Audio file and noteId are required' },
        { status: 400 }
      );
    }

    console.log(`🎤 Uploading voice note for note: ${noteId}`);

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

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'voice-notes');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file to disk
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileId = uuidv4();
    const fileName = `${fileId}.webm`;
    const filePath = join(uploadsDir, fileName);

    await writeFile(filePath, buffer);
    console.log(`✅ Audio file saved: ${fileName}`);

    // Save to database
    const recordingId = uuidv4();
    const audioUrl = `/uploads/voice-notes/${fileName}`;

    await executeQuery(
      `INSERT INTO note_voice_recordings 
       (id, note_id, audio_url, file_name, duration_seconds, file_size_bytes, time_markers, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        recordingId,
        noteId,
        audioUrl,
        audioFile.name,
        duration,
        audioFile.size,
        JSON.stringify([]),
      ]
    );

    // Update note to mark as having voice notes
    await executeQuery(
      'UPDATE user_notes SET has_voice_notes = TRUE WHERE id = ?',
      [noteId]
    );

    console.log(`✅ Voice recording saved to database: ${recordingId}`);

    return NextResponse.json({
      success: true,
      id: recordingId,
      audio_url: audioUrl,
      file_name: audioFile.name,
      duration_seconds: duration,
    });
  } catch (error) {
    console.error('❌ Error uploading voice note:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload voice note',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice-notes?noteId=xxx
 * Fetch voice recordings for a note
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

    // Fetch recordings
    const recordings = await executeQuery<VoiceRecordingRow>(
      `SELECT * FROM note_voice_recordings 
       WHERE note_id = ? 
       ORDER BY recorded_at DESC`,
      [noteId]
    );

    return NextResponse.json({
      success: true,
      recordings,
      count: recordings.length,
    });
  } catch (error) {
    console.error('❌ Error fetching voice notes:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch voice notes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

