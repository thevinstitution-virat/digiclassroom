/**
 * Note Folders API
 * GET /api/notes/folders - List user's folders
 * POST /api/notes/folders - Create a new folder
 */

import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

/**
 * GET - List all folders for the current user
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📂 Fetching folders for user:', userId);

        // Check if note_folders table exists first
        let folders: any[] = [];

        try {
            const query = `
        SELECT 
          id, name, description, parent_folder_id, color, icon, sort_order,
          created_at, updated_at
        FROM note_folders
        WHERE id = ?
        ORDER BY sort_order ASC, name ASC
      `;

            folders = await executeQuery(query, [userId]);
        } catch (tableError: unknown) {
            // If table doesn't exist, return empty array with agent-based default folders
        // @ts-ignore
            if (tableError.code === 'ER_NO_SUCH_TABLE') {
                console.log('📂 note_folders table does not exist, returning agent defaults');
                folders = [];
            } else {
                throw tableError;
            }
        }

        // Add default agent-based folders if none exist
        const defaultFolders = [
            { id: 'deep_dive', name: 'Deep Dive Agent', description: 'Notes from detailed explanations', color: '#3B82F6', icon: 'Search', isDefault: true },
            { id: 'selfstudy_buddy', name: 'Selfstudy Buddy', description: 'Study help notes', color: '#10B981', icon: 'BookOpen', isDefault: true },
            { id: 'exam_prep', name: 'Exam Prep Pro', description: 'Exam preparation notes', color: '#F59E0B', icon: 'Target', isDefault: true },
            { id: 'doubt_resolution', name: 'Doubt Resolution', description: 'Doubt clarification notes', color: '#8B5CF6', icon: 'HelpCircle', isDefault: true },
            { id: 'personal', name: 'Personal Notes', description: 'Personal study notes', color: '#EF4444', icon: 'Folder', isDefault: true },
        ];

        // Merge default folders with user folders (defaults shown if no folders created)
        const allFolders = folders.length > 0 ? folders : defaultFolders;

        return NextResponse.json({
            success: true,
            folders: allFolders,
            count: allFolders.length
        });

    } catch (error) {
        console.error('❌ Error fetching folders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch folders', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * POST - Create a new folder
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json() as Record<string, unknown>;
        const { name, description, color = '#3B82F6', icon = 'Folder', parent_folder_id = null } = body;

        // @ts-ignore
        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const folderId = uuidv4();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        console.log('📂 Creating folder:', { name, folderId, userId });

        // Try to create the folder
        try {
            const insertQuery = `
        INSERT INTO note_folders (
          id, user_id, name, description, parent_folder_id, color, icon, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            await executeUpdate(insertQuery, [
                folderId,
                userId,
        // @ts-ignore
                name.trim(),
                description || null,
                parent_folder_id,
                color,
                icon,
                0, // sort_order
                now,
                now
            ]);

            console.log('✅ Folder created:', folderId);

            return NextResponse.json({
                success: true,
                folder: {
                    id: folderId,
        // @ts-ignore
                    name: name.trim(),
                    description,
                    color,
                    icon,
                    parent_folder_id,
                    created_at: now
                }
            });

        } catch (tableError: unknown) {
            // If table doesn't exist, return a "virtual" folder ID for the current session
        // @ts-ignore
            if (tableError.code === 'ER_NO_SUCH_TABLE') {
                console.warn('⚠️ note_folders table does not exist, returning virtual folder');
                return NextResponse.json({
                    success: true,
                    folder: {
        // @ts-ignore
                        id: `virtual_${name.toLowerCase().replace(/\s+/g, '_')}`,
        // @ts-ignore
                        name: name.trim(),
                        description,
                        color,
                        icon,
                        isVirtual: true
                    },
                    message: 'Folder created virtually (database table not yet created)'
                });
            }
            throw tableError;
        }

    } catch (error) {
        console.error('❌ Error creating folder:', error);
        return NextResponse.json(
            { error: 'Failed to create folder', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
