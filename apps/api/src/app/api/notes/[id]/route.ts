import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { syncNoteLinks } from '@/lib/sanchika/note-links';

/**
 * GET /api/notes/[id]
 * Fetch a single note by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;
    console.log('🔍 Fetching note:', noteId);

    const query = `
      SELECT
        n.id, n.title, n.content, n.content_format, n.subject, n.chapter, n.board, n.class_level,
        n.orientation, n.tags, n.source_type, n.source_query,
        n.is_favorite, n.is_archived, n.is_pinned, n.folder_id,
        n.created_at, n.updated_at, n.last_accessed_at,
        f.id as folder_id_full, f.name as folder_name, f.color as folder_color, f.icon as folder_icon
      FROM user_notes n
      LEFT JOIN note_folders f ON n.folder_id = f.id
      WHERE n.id = ? AND n.user_id = ?
      LIMIT 1
    `;

    const notes = await executeQuery(query, [noteId, userId]);

    if (!notes || notes.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const note = notes[0] as typeof notes[0];

    // Parse JSON fields
    if (note.tags && typeof note.tags === 'string') {
      try {
        note.tags = JSON.parse(note.tags);
      } catch {
        note.tags = [];
      }
    }

    // Build folder object if folder data exists
    if (note.folder_id && note.folder_name) {
      note.folder = {
        id: note.folder_id,
        name: note.folder_name,
        color: note.folder_color,
        icon: note.folder_icon,
      };
    }

    // Clean up redundant fields
    delete note.folder_id_full;
    delete note.folder_name;
    delete note.folder_color;
    delete note.folder_icon;

    console.log(' Note fetched');
    return NextResponse.json({ note });

  } catch (error: unknown) {
        // @ts-ignore
    console.error(' [Notes] GET error:', error.message);
    return NextResponse.json(
        // @ts-ignore
      { error: error.message || 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notes/[id]
 * Update an existing note - supports partial updates (only updates fields that are provided)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;
    const body = await req.json() as Record<string, unknown>;

    console.log('📝 Updating note:', noteId, 'Fields provided:', Object.keys(body));

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const updateParams: any[] = [];

    // Map of allowed fields and their DB column names
    const fieldMappings: Record<string, string> = {
      title: 'title',
      content: 'content',
      content_format: 'content_format',
      subject: 'subject',
      chapter: 'chapter',
      board: 'board',
      class_level: 'class_level',
      folder_id: 'folder_id',
      orientation: 'orientation',
      page_size: 'page_size',
      page_margins: 'page_margins',
      cover_design: 'cover_design',
      spine_color: 'spine_color',
      is_favorite: 'is_favorite',
      is_pinned: 'is_pinned',
      is_archived: 'is_archived',
    };

    // Process each provided field
    for (const [key, dbColumn] of Object.entries(fieldMappings)) {
      if (body[key] !== undefined) {
        updateFields.push(`${dbColumn} = ?`);

        // Handle special cases
        if (key === 'is_favorite' || key === 'is_pinned' || key === 'is_archived') {
          updateParams.push(Boolean(body[key]));
        } else {
          updateParams.push(body[key]);
        }
      }
    }

    // Handle tags separately (needs JSON stringification)
    if (body.tags !== undefined) {
      updateFields.push('tags = ?');
      updateParams.push(JSON.stringify(body.tags || []));
    }

    // Always update updated_at timestamp
    updateFields.push('updated_at = ?');
    updateParams.push(now);

    // Add WHERE clause parameters
    updateParams.push(noteId);
    updateParams.push(userId);

    if (updateFields.length === 1) {
      // Only updated_at, no actual changes
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updateQuery = `
      UPDATE user_notes
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    const updateResult = await executeUpdate(updateQuery, updateParams);

    if (!updateResult.affectedRows || updateResult.affectedRows === 0) {
      return NextResponse.json({ error: 'Note not found or no changes made' }, { status: 404 });
    }

    console.log(' Note updated');

    // Re-index wiki-links when content changed (non-critical).
    try {
      if (body.content !== undefined) await syncNoteLinks(userId, noteId, String(body.content ?? ''));
    } catch (linkErr) {
      console.warn('⚠️ [Notes] note-links sync failed (non-critical):', linkErr);
    }

    // Return updated note
    const fetchQuery = `
      SELECT
        id, title, content, content_format, subject, chapter, board, class_level,
        orientation, tags, source_type, source_query,
        is_favorite, is_archived, is_pinned, folder_id,
        created_at, updated_at, last_accessed_at
      FROM user_notes
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `;

    const notes = await executeQuery(fetchQuery, [noteId, userId]);

    if (!notes || notes.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const note = notes[0] as typeof notes[0];

    // Parse JSON fields
    if (note.tags && typeof note.tags === 'string') {
      try {
        note.tags = JSON.parse(note.tags);
      } catch {
        note.tags = [];
      }
    }

    return NextResponse.json({ note });

  } catch (error: unknown) {
        // @ts-ignore
    console.error(' [Notes] PUT error:', error.message);
    return NextResponse.json(
        // @ts-ignore
      { error: error.message || 'Failed to update note' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notes/[id]
 * Delete a note by ID
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;
    console.log(' Deleting note:', noteId);

    const deleteQuery = `
      DELETE FROM user_notes
      WHERE id = ? AND user_id = ?
    `;

    const deleteResult = await executeUpdate(deleteQuery, [noteId, userId]);

    if (!deleteResult.affectedRows || deleteResult.affectedRows === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    console.log(' Note deleted');

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
        // @ts-ignore
    console.error(' [Notes] DELETE error:', error.message);
    return NextResponse.json(
        // @ts-ignore
      { error: error.message || 'Failed to delete note' },
      { status: 500 }
    );
  }
}