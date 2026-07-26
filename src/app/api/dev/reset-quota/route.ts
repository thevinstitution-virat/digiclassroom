/**
 * Development API: Reset User Quota
 * 
 * This endpoint resets the daily question quota for a specific user.
 * USE ONLY IN DEVELOPMENT MODE!
 * 
 * Usage: GET /api/dev/reset-quota?userId=user_xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'user_2yi9QK4dLkbW8dpwS3FlEFkUMD6';

    console.log('🔄 [DEV] Resetting quota for user:', userId);

    // Get today's date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check current usage
    const currentUsage = await executeQuery<any>(
      'SELECT * FROM ai_tutor_usage WHERE id = ? AND usage_date = ?',
      [userId, today]
    );

    let resetPerformed = false;
    let previousUsage = null;

    if (currentUsage.length > 0) {
      previousUsage = {
        questions_asked: currentUsage[0].questions_asked,
        daily_limit: currentUsage[0].daily_limit,
        usage_date: currentUsage[0].usage_date
      };

      console.log('📊 [DEV] Current usage:', previousUsage);

      // Delete today's usage record
      await executeQuery(
        'DELETE FROM ai_tutor_usage WHERE id = ? AND usage_date = ?',
        [userId, today]
      );

      resetPerformed = true;
      console.log('✅ [DEV] Quota reset successfully!');
    } else {
      console.log('ℹ️ [DEV] No usage record found for today - quota is already at 0');
    }

    // Also delete quota alerts for today
    await executeQuery(
      'DELETE FROM quota_alerts WHERE id = ? AND DATE(created_at) = ?',
      [userId, today]
    );

    console.log('🧹 [DEV] Cleaned up quota alerts');

    // Show all usage history for this user
    const allUsage = await executeQuery<any>(
      'SELECT usage_date, questions_asked, daily_limit FROM ai_tutor_usage WHERE id = ? ORDER BY usage_date DESC LIMIT 10',
      [userId]
    );

    console.log('📈 [DEV] Recent usage history:', allUsage);

    return NextResponse.json({
      success: true,
      message: resetPerformed 
        ? 'Quota reset successfully! User can now ask questions again.' 
        : 'No quota to reset - user has not asked any questions today.',
      userId,
      today,
      resetPerformed,
      previousUsage,
      recentHistory: allUsage,
      note: 'This is a development-only endpoint. It will not work in production.'
    });

  } catch (error) {
    console.error('❌ [DEV] Error resetting quota:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset quota', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

