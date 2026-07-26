import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import {
  updatePreGeneratedAnswer,
  deletePreGeneratedAnswer
} from '@/lib/services/pre-generated-answers-service';

export const runtime = 'nodejs';

/**
 * PUT /api/super-admin/pre-generated-answers/[id]
 * Update a pre-generated answer
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!isPlatformStaff((session?.user?.role ?? '') as Role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // TODO: Add admin role check here

    const body = await req.json() as Record<string, unknown>;
    const { answer, key_terms, difficulty_level } = body;

    const success = await updatePreGeneratedAnswer(params.id, {
      answer,
      key_terms,
      difficulty_level
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update answer or answer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Answer updated successfully'
    });
  } catch (error) {
    console.error('Error updating pre-generated answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/super-admin/pre-generated-answers/[id]
 * Delete a pre-generated answer
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!isPlatformStaff((session?.user?.role ?? '') as Role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // TODO: Add admin role check here

    const success = await deletePreGeneratedAnswer(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete answer or answer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Answer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting pre-generated answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

