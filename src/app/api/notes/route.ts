import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { syncNoteLinks } from '@/lib/sanchika/note-links';

export async function POST(req: Request) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Org context for multi-tenant tagging. Validated against the organization
    // table so a stale/forged x-org-id header can't break creation via the FK.
    // (Access control still relies on user_id — see reads.)
    let orgId: string | null = hdrs.get('x-org-id') || null;
    if (orgId) {
      const orgRows = await executeQuery('SELECT id FROM organization WHERE id = ? LIMIT 1', [orgId]);
      if (!Array.isArray(orgRows) || orgRows.length === 0) orgId = null;
    }

    const body = await req.json() as Record<string, unknown>;
    const {
      title = 'Untitled Note',
      content = '',
      content_format = 'markdown',
      subject = null,
      chapter = null,
      board = null,
      class_level = null,
      tags = [],
      folder_id = null,
      cover_design = 'solid-blue',
      spine_color = '#3B82F6',
      is_favorite = false,
      is_pinned = false,
      source_type = 'manual',
      source_query = null,
    } = body;

    // Validation
        // @ts-ignore
    if (!title || title.trim() === '') {
      return NextResponse.json(
        { error: 'Note title is required' },
        { status: 400 }
      );
    }

    // Generate note ID
    const noteId = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    console.log('📝 Creating new note:', {
      noteId,
      userId,
        // @ts-ignore
      title: title.substring(0, 50),
    });

    // ============ INSERT INTO user_notes ============
    // Schema columns: id, user_id, title, content, subject, chapter, board, class_level,
    // orientation, tags, folder_id, source_type, source_query, source_answer, source_visualizations,
    // is_favorite, is_archived, is_pinned, created_at, updated_at, last_accessed_at
    const insertQuery = `
      INSERT INTO user_notes (
        id,
        user_id,
        organization_id,
        title,
        content,
        content_format,
        subject,
        chapter,
        board,
        class_level,
        tags,
        folder_id,
        source_type,
        source_query,
        source_answer,
        cover_design,
        spine_color,
        is_favorite,
        is_pinned,
        is_archived,
        created_at,
        updated_at,
        last_accessed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const insertParams = [
      noteId,
      userId,
      orgId,
        // @ts-ignore
      title.trim(),
      content,
      content_format || 'markdown',
      subject || null,
      chapter || null,
      board || null,
      class_level || null,
      JSON.stringify(tags),
      folder_id || null,
      source_type,
      source_query || null,
      content, // source_answer - store original content as answer
      cover_design || 'solid-blue',
      spine_color || '#3B82F6',
      is_favorite ? 1 : 0,
      is_pinned ? 1 : 0,
      0, // is_archived
      now,
      now,
      now,
    ];

    console.log('🔄 Inserting note with params:', {
      paramCount: insertParams.length,
      title: insertParams[2],
      content_length: insertParams[3]?.length || 0,
    });

    const insertResult = await executeUpdate(insertQuery, insertParams);

    if (!insertResult.affectedRows || insertResult.affectedRows === 0) {
      throw new Error('Failed to insert note into database');
    }

    console.log('✅ Note inserted successfully:', {
      affectedRows: insertResult.affectedRows,
      noteId,
    });

    // ============ LOG ACTIVITY (after successful note creation) ============
    // Activity log schema uses: note_id, user_id, action (not user_id/activity_type)
    // ID is auto-increment BIGINT, not UUID
    const activityQuery = `
      INSERT INTO note_activity_log (
        note_id,
        user_id,
        action,
        created_at
      ) VALUES (?, ?, ?, ?)
    `;

    const activityParams = [
      noteId,
      userId, // user_id
      'created',
      now,
    ];

    console.log('📊 Logging activity for note:', noteId);

    try {
      await executeUpdate(activityQuery, activityParams);
      console.log('✅ Activity logged');
    } catch (activityError) {
      // Don't fail the whole operation if activity logging fails
      console.warn('⚠️ Activity logging failed (non-critical):', activityError);
    }

    // ============ FETCH AND RETURN CREATED NOTE ============
    console.log('📖 Fetching created note:', noteId);

    const fetchQuery = `
      SELECT
        id, title, content, subject, chapter, board, class_level,
        orientation, tags, source_type, source_query, source_answer,
        is_favorite, is_archived, is_pinned, folder_id,
        created_at, updated_at, last_accessed_at
      FROM user_notes
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `;

    const notes = await executeQuery(fetchQuery, [noteId, userId]);

    if (!notes || notes.length === 0) {
      throw new Error('Failed to fetch created note');
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

    console.log('✅ Note created and fetched successfully:', note.id);

    // Index wiki-links for backlinks / graph (non-critical).
    try {
      await syncNoteLinks(userId, noteId, String(content ?? ''));
    } catch (linkErr) {
      console.warn('⚠️ [Notes] note-links sync failed (non-critical):', linkErr);
    }

    return NextResponse.json({ note }, { status: 201 });

  } catch (error: unknown) {
        // @ts-ignore
    console.error('❌ [Notes] POST error:', error.message);
    console.error('Full error:', error);

    return NextResponse.json(
      {
        // @ts-ignore
        error: error.message || 'Failed to create note',
        // @ts-ignore
        code: error.code,
        // @ts-ignore
        sqlState: error.sqlState,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const nextHeaders = await headers();
    const cookieString = nextHeaders.get('cookie') || '';
    console.log('[Notes GET] next/headers cookie length:', cookieString.length);
    console.log('[Notes GET] has better-auth token in next/headers:', cookieString.includes('better-auth.session_token'));
    
    const session = await auth.api.getSession({ headers: nextHeaders });
    console.log('[Notes GET] session object:', session ? 'found' : 'null');
    
    const userId = session?.user?.id;
    if (!userId) {
      console.log('[Notes GET] rejecting with 401. session was null.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    // FETCH SINGLE NOTE
    if (id && id !== 'new') {
      console.log('🔍 Fetching single note:', id);

      const query = `
        SELECT
          n.id, n.title, n.content, n.content_format, n.subject, n.chapter, n.board, n.class_level,
          n.orientation, n.cover_design, n.spine_color, n.page_size, n.page_margins,
          n.tags, n.source_type, n.source_query,
          n.is_favorite, n.is_archived, n.is_pinned, n.folder_id,
          n.created_at, n.updated_at, n.last_accessed_at,
          f.id as folder_id_full, f.name as folder_name, f.color as folder_color, f.icon as folder_icon
        FROM user_notes n
        LEFT JOIN note_folders f ON n.folder_id = f.id
        WHERE n.id = ? AND n.user_id = ?
        LIMIT 1
      `;

      const notes = await executeQuery(query, [id, userId]);

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

      console.log('✅ Note fetched');
      return NextResponse.json({ note });
    }

    // FETCH LIST OF NOTES
    console.log('📊 Fetching notes for user:', userId);

    // Optional full-text search (?search=) via the FULLTEXT(title, content) index.
    // Boolean mode + a prefix wildcard so partial words still match.
    const search = (searchParams.get('search') || '').trim();
    const listParams: unknown[] = [userId];
    let searchClause = '';
    if (search) {
      const ftTerms = search
        .replace(/[+\-><()~*"@]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `${t}*`)
        .join(' ');
      if (ftTerms) {
        searchClause = 'AND MATCH(n.title, n.content) AGAINST (? IN BOOLEAN MODE)';
        listParams.push(ftTerms);
      }
    }
    listParams.push(limit, offset);

    const query = `
      SELECT
        n.id, n.title, n.content, n.content_format, n.subject, n.chapter, n.board, n.class_level,
        n.orientation, n.tags, n.source_type, n.source_query,
        n.cover_design, n.spine_color,
        n.is_favorite, n.is_archived, n.is_pinned, n.folder_id,
        n.created_at, n.updated_at, n.last_accessed_at,
        f.id as folder_id_full, f.name as folder_name, f.color as folder_color, f.icon as folder_icon
      FROM user_notes n
      LEFT JOIN note_folders f ON n.folder_id = f.id
      WHERE n.user_id = ?
        AND n.is_archived = 0
        ${searchClause}
      ORDER BY n.updated_at DESC
      LIMIT ?
      OFFSET ?
    `;

    const notes = await executeQuery(query, listParams);

    // Parse JSON fields for all notes and build folder objects
    const parsedNotes = (notes || []).map((note: any) => {
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

      return note;
    });

    console.log(`✅ Query successful, returned ${parsedNotes.length} rows`);
    return NextResponse.json(parsedNotes || []);

  } catch (error: unknown) {
        // @ts-ignore
    console.error('❌ [Notes] GET error:', error.message);
    return NextResponse.json(
        // @ts-ignore
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}




export async function PUT(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const {
      id,
      title,
      content,
      content_format,
      subject,
      chapter,
      board,
      class_level,
      tags,
      is_favorite,
      is_pinned,
      is_archived,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    console.log('📝 Updating note:', id);

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const updateQuery = `
      UPDATE user_notes
      SET
        title = ?,
        content = ?,
        content_format = ?,
        subject = ?,
        chapter = ?,
        board = ?,
        class_level = ?,
        tags = ?,
        is_favorite = ?,
        is_pinned = ?,
        is_archived = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `;

    const updateParams = [
      title,
      content,
      content_format,
      subject || null,
      chapter || null,
      board || null,
      class_level || null,
      JSON.stringify(tags || []),
      is_favorite ? 1 : 0,
      is_pinned ? 1 : 0,
      is_archived ? 1 : 0,
      now,
      id,
      userId,
    ];

    const updateResult = await executeUpdate(updateQuery, updateParams);

    if (!updateResult.affectedRows || updateResult.affectedRows === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    console.log('✅ Note updated');

    // Re-index wiki-links when content changed (non-critical).
    try {
      if (content !== undefined) await syncNoteLinks(userId, id as string, String(content ?? ''));
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
      WHERE id = ? AND (user_id = ? OR user_id = ?)
      LIMIT 1
    `;

    const notes = await executeQuery(fetchQuery, [id, userId, userId]);

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
    console.error('❌ [Notes] PUT error:', error.message);
    return NextResponse.json(
        // @ts-ignore
      { error: error.message || 'Failed to update note' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    console.log('🗑️ Deleting note:', id);

    const deleteQuery = `
      DELETE FROM user_notes
      WHERE id = ? AND user_id = ?
    `;

    const deleteResult = await executeUpdate(deleteQuery, [id, userId]);

    if (!deleteResult.affectedRows || deleteResult.affectedRows === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    console.log('✅ Note deleted');

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
        // @ts-ignore
    console.error('❌ [Notes] DELETE error:', error.message);
    return NextResponse.json(
        // @ts-ignore
      { error: error.message || 'Failed to delete note' },
      { status: 500 }
    );
  }
}
