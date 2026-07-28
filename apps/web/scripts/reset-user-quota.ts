/**
 * Development Script: Reset User Quota
 *
 * This script resets the daily question quota for a specific user.
 * USE ONLY IN DEVELOPMENT MODE!
 */

import { rawQuery } from '../src/db/raw';

async function resetUserQuota(clerkUserId: string) {
  console.log('🔄 Resetting quota for user:', clerkUserId);

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check current usage
    const currentUsage = await rawQuery<any>(
      'SELECT * FROM ai_tutor_usage WHERE clerk_id = ? AND usage_date = ?',
      [clerkUserId, today]
    );

    if (currentUsage.length > 0) {
      console.log('📊 Current usage:', {
        questions_asked: currentUsage[0].questions_asked,
        daily_limit: currentUsage[0].daily_limit,
        usage_date: currentUsage[0].usage_date
      });

      // Delete today's usage record
      await rawQuery(
        'DELETE FROM ai_tutor_usage WHERE clerk_id = ? AND usage_date = ?',
        [clerkUserId, today]
      );

      console.log('✅ Quota reset successfully!');
      console.log('🎉 User can now ask questions again (fresh daily limit)');
    } else {
      console.log('ℹ️ No usage record found for today - quota is already at 0');
    }

    // Also delete quota alerts for today
    await rawQuery(
      "DELETE FROM quota_alerts WHERE clerk_id = ? AND DATE(created_at) = ?",
      [clerkUserId, today]
    );

    console.log('🧹 Cleaned up quota alerts');

    // Show all usage history for this user
    const allUsage = await rawQuery<any>(
      'SELECT usage_date, questions_asked, daily_limit FROM ai_tutor_usage WHERE clerk_id = ? ORDER BY usage_date DESC LIMIT 10',
      [clerkUserId]
    );

    console.log('\n📈 Recent usage history:');
    console.table(allUsage);

  } catch (error) {
    console.error('❌ Error resetting quota:', error);
    throw error;
  }
}

// Get user ID from command line or use default
const userId = process.argv[2] || 'user_2yi9QK4dLkbW8dpwS3FlEFkUMD6';

resetUserQuota(userId)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
