import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  listPreGeneratedAnswers, 
  getPreGeneratedAnswersStats 
} from '@/lib/services/pre-generated-answers-service';

export const runtime = 'nodejs';

/**
 * GET /api/admin/pre-generated-answers
 * List all pre-generated answers with pagination and filtering
 */
export async function GET(req: NextRequest) {
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
    // For now, any authenticated user can access

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const subject = searchParams.get('subject') || undefined;
    const classLevel = searchParams.get('classLevel') || undefined;
    const board = searchParams.get('board') || undefined;
    const sortBy = (searchParams.get('sortBy') || 'created_at') as 'created_at' | 'hit_count' | 'last_served_at';
    const sortOrder = (searchParams.get('sortOrder') || 'DESC') as 'ASC' | 'DESC';

    // Get paginated results
    const result = await listPreGeneratedAnswers({
      page,
      limit,
      subject,
      classLevel,
      board,
      sortBy,
      sortOrder
    });

    // Get statistics
    const stats = await getPreGeneratedAnswersStats();

    return NextResponse.json({
      success: true,
      data: result,
      stats
    });
  } catch (error) {
    console.error('Error listing pre-generated answers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

