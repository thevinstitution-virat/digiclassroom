import { executeQuery } from '@/lib/db/connection';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/notes/[id]/backlinks
 * Notes that link TO this note (via [[wiki links]]).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteId = params.id;

    const backlinks = await executeQuery(
      `SELECT n.id, n.title, n.subject, n.updated_at, nl.link_text
       FROM note_links nl
       JOIN user_notes n ON n.id = nl.source_note_id
       WHERE nl.target_note_id = ? AND nl.user_id = ? AND n.is_archived = 0
       ORDER BY n.updated_at DESC`,
      [noteId, userId]
    );

    return NextResponse.json({ backlinks: backlinks || [] });
  } catch (error: unknown) {
    console.error('❌ [Backlinks] error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Failed to fetch backlinks' }, { status: 500 });
  }
}
