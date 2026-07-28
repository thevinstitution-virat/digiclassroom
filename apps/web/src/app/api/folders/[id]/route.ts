import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';

/**
 * GET /api/folders/[id]
 * Fetch a single folder by ID
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

    const folderId = params.id;

    console.log('📁 Fetching folder:', folderId, 'for user:', userId);

    const folder = await executeQuery(
      `SELECT * FROM note_folders WHERE id = ? AND user_id = ? LIMIT 1`,
      [folderId, userId]
    );

    if (!folder || folder.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    console.log('✅ Folder found:', folder[0]);

    return NextResponse.json(folder[0], { status: 200 });
  } catch (error) {
    console.error('❌ Error fetching folder:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/folders/[id]
 * Update a folder
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

    const folderId = params.id;
    const body = await req.json() as Record<string, unknown>;
    const { name, color, icon } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    console.log('📁 Updating folder:', folderId, 'for user:', userId);

    // Verify ownership
    const existingFolder = await executeQuery(
      `SELECT * FROM note_folders WHERE id = ? AND user_id = ? LIMIT 1`,
      [folderId, userId]
    );

    if (!existingFolder || existingFolder.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    await executeQuery(
      `UPDATE note_folders SET name = ?, color = ?, icon = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [name.trim(), color || 'blue', icon || 'folder', folderId, userId]
    );

    const updatedFolder = await executeQuery(
      `SELECT * FROM note_folders WHERE id = ?`,
      [folderId]
    );

    console.log('✅ Folder updated:', updatedFolder[0]);

    return NextResponse.json(updatedFolder[0], { status: 200 });
  } catch (error) {
    console.error('❌ Error updating folder:', error);
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete a folder (notes in the folder will have their folder_id set to null)
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

    const folderId = params.id;

    console.log('📁 Deleting folder:', folderId, 'for user:', userId);

    // Verify ownership
    const existingFolder = await executeQuery(
      `SELECT * FROM note_folders WHERE id = ? AND user_id = ? LIMIT 1`,
      [folderId, userId]
    );

    if (!existingFolder || existingFolder.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Update notes to remove folder_id
    await executeQuery(
      `UPDATE user_notes SET folder_id = NULL, updated_at = NOW() WHERE folder_id = ?`,
      [folderId]
    );

    // Delete the folder
    await executeQuery(
      `DELETE FROM note_folders WHERE id = ? AND user_id = ?`,
      [folderId, userId]
    );

    console.log('✅ Folder deleted');

    return NextResponse.json(
      { message: 'Folder deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}

