import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';

/**
 * GET /api/folders
 * Fetch all folders for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📁 Fetching folders for user:', userId);

    const userFolders = await executeQuery(
      `SELECT * FROM note_folders WHERE user_id = ? ORDER BY created_at ASC`,
      [userId]
    );

    console.log('✅ Found folders:', userFolders.length);

    return NextResponse.json(userFolders, { status: 200 });
  } catch (error) {
    console.error('❌ Error fetching folders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders
 * Create a new folder
 */
export async function POST(req: NextRequest) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Org context (validated to avoid FK failures from a stale/forged header).
    let orgId: string | null = hdrs.get('x-org-id') || null;
    if (orgId) {
      const orgRows = await executeQuery('SELECT id FROM organization WHERE id = ? LIMIT 1', [orgId]);
      if (!Array.isArray(orgRows) || orgRows.length === 0) orgId = null;
    }

    const body = await req.json() as Record<string, unknown>;
    const { name, color, icon } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    console.log('📁 Creating folder:', name, 'for user:', userId);

    // Generate UUID for the folder
    const folderId = crypto.randomUUID();

    await executeQuery(
      `INSERT INTO note_folders (id, user_id, organization_id, name, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [folderId, userId, orgId, name.trim(), color || 'blue', icon || 'folder']
    );

    const newFolder = await executeQuery(
      `SELECT * FROM note_folders WHERE id = ?`,
      [folderId]
    );

    console.log('✅ Folder created:', newFolder[0]);

    return NextResponse.json(newFolder[0], { status: 201 });
  } catch (error) {
    console.error('❌ Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

