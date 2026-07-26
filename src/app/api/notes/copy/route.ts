/**
 * API Route: Copy Note
 * POST /api/notes/copy
 * 
 * Duplicates a note and optionally places it in a different folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // ============ AUTHENTICATION ============
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============ PARSE REQUEST BODY ============
    const { noteId, folderId } = await req.json() as Record<string, unknown>;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    // ============ FETCH SOURCE NOTE ============
    const sourceNotes = await executeQuery(
      `SELECT * FROM user_notes WHERE id = ? AND user_id = ?`,
      [noteId, userId]
    );

    if (!Array.isArray(sourceNotes) || sourceNotes.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const sourceNote = sourceNotes[0];

    // ============ CREATE DUPLICATE NOTE ============
    const newNoteId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertQuery = `
      INSERT INTO user_notes (
        id, user_id, user_id, title, content, content_format,
        subject, chapter, board, class_level, tags, folder_id,
        cover_design, spine_color,
        source_type, source_query, is_favorite, is_pinned, is_archived,
        created_at, updated_at, last_accessed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const insertValues = [
      newNoteId,
      userId,
      userId,
      `${sourceNote.title} (Copy)`,
      sourceNote.content,
      sourceNote.content_format || 'html',
      sourceNote.subject || null,
      sourceNote.chapter || null,
      sourceNote.board || null,
      sourceNote.class_level || null,
      sourceNote.tags || null,
      folderId || null,
      sourceNote.cover_design || 'solid-blue',
      sourceNote.spine_color || '#3B82F6',
      sourceNote.source_type || null,
      sourceNote.source_query || null,
      0, // is_favorite
      0, // is_pinned
      0, // is_archived
      now,
      now,
      now,
    ];

    await executeQuery(insertQuery, insertValues);

    // ============ FETCH CREATED NOTE WITH FOLDER INFO ============
    const createdNotes = await executeQuery(
      `SELECT
        n.id, n.title, n.content, n.content_format, n.subject, n.chapter, n.board, n.class_level,
        n.orientation, n.tags, n.source_type, n.source_query,
        n.cover_design, n.spine_color,
        n.is_favorite, n.is_archived, n.is_pinned, n.folder_id,
        n.created_at, n.updated_at, n.last_accessed_at,
        f.id as folder_id_full, f.name as folder_name, f.color as folder_color, f.icon as folder_icon
      FROM user_notes n
      LEFT JOIN note_folders f ON n.folder_id = f.id
      WHERE n.id = ?`,
      [newNoteId]
    );

    if (!Array.isArray(createdNotes) || createdNotes.length === 0) {
      return NextResponse.json({ error: 'Failed to retrieve copied note' }, { status: 500 });
    }

    const createdNote = createdNotes[0];

    // Transform folder data
    const transformedNote = {
      ...createdNote,
      folder: createdNote.folder_id_full
        ? {
            id: createdNote.folder_id_full,
            name: createdNote.folder_name,
            color: createdNote.folder_color,
            icon: createdNote.folder_icon,
          }
        : null,
    };

    // Remove redundant folder fields
    delete transformedNote.folder_id_full;
    delete transformedNote.folder_name;
    delete transformedNote.folder_color;
    delete transformedNote.folder_icon;

    // ============ RETURN SUCCESS ============
    return NextResponse.json(
      {
        message: 'Note copied successfully',
        note: transformedNote,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Copy note error:', error);
    return NextResponse.json(
      { error: 'Failed to copy note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

