import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * DELETE /api/voice-notes/[id]
 * Delete a voice recording
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch recording and verify ownership
    const recordings = await executeQuery<any>(
      `SELECT vr.*, n.user_id 
       FROM note_voice_recordings vr
       JOIN user_notes n ON vr.note_id = n.id
       WHERE vr.id = ?`,
      [id]
    );

    if (recordings.length === 0) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const recording = recordings[0];

    if (recording.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete file from disk
    const filePath = join(process.cwd(), 'public', recording.audio_url);
    if (existsSync(filePath)) {
      await unlink(filePath);
      console.log(`✅ Deleted audio file: ${recording.audio_url}`);
    }

    // Delete from database
    await executeQuery('DELETE FROM note_voice_recordings WHERE id = ?', [id]);

    // Check if note still has voice recordings
    const remainingRecordings = await executeQuery<any>(
      'SELECT COUNT(*) as count FROM note_voice_recordings WHERE note_id = ?',
      [recording.note_id]
    );

    if (remainingRecordings[0].count === 0) {
      await executeQuery(
        'UPDATE user_notes SET has_voice_notes = FALSE WHERE id = ?',
        [recording.note_id]
      );
    }

    console.log(`✅ Voice recording deleted: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting voice note:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete voice note',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/voice-notes/[id]
 * Update voice recording (e.g., time markers)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;
    const { time_markers } = body;

    // Fetch recording and verify ownership
    const recordings = await executeQuery<any>(
      `SELECT vr.*, n.user_id 
       FROM note_voice_recordings vr
       JOIN user_notes n ON vr.note_id = n.id
       WHERE vr.id = ?`,
      [id]
    );

    if (recordings.length === 0) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    if (recordings[0].user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update time markers
    if (time_markers !== undefined) {
      await executeQuery(
        'UPDATE note_voice_recordings SET time_markers = ? WHERE id = ?',
        [JSON.stringify(time_markers), id]
      );
    }

    console.log(`✅ Voice recording updated: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating voice note:', error);
    return NextResponse.json(
      {
        error: 'Failed to update voice note',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

