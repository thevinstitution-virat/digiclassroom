import { executeQuery } from '@/lib/db/connection';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * GET /api/notes/graph
 * Knowledge graph for the current user: nodes (notes) + links (wiki links).
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nodes = await executeQuery(
      `SELECT id, title, subject, folder_id FROM user_notes
       WHERE user_id = ? AND is_archived = 0`,
      [userId]
    );

    const links = await executeQuery(
      `SELECT DISTINCT nl.source_note_id AS source, nl.target_note_id AS target
       FROM note_links nl
       JOIN user_notes s ON s.id = nl.source_note_id AND s.is_archived = 0
       JOIN user_notes t ON t.id = nl.target_note_id AND t.is_archived = 0
       WHERE nl.user_id = ?
         AND nl.target_note_id IS NOT NULL
         AND nl.source_note_id <> nl.target_note_id`,
      [userId]
    );

    return NextResponse.json({ nodes: nodes || [], links: links || [] });
  } catch (error: unknown) {
    console.error('❌ [Graph] error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Failed to build graph' }, { status: 500 });
  }
}
