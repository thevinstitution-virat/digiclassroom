import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  updatePreGeneratedAnswer, 
  deletePreGeneratedAnswer 
} from '@/lib/services/pre-generated-answers-service';

export const runtime = 'nodejs';

/**
 * PUT /api/admin/pre-generated-answers/[id]
 * Update a pre-generated answer
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Add admin role check here

    const body = await req.json();
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
 * DELETE /api/admin/pre-generated-answers/[id]
 * Delete a pre-generated answer
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

