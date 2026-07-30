import { db } from '@/db';
import { userSubscriptions, sarvagyaCreditTransactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Validates if the user has sufficient credits to execute a query.
 */
export async function checkSarvagyaCredits(userId: string): Promise<number> {
    const [subscription] = await db
        .select({ credits: userSubscriptions.sarvagyaCredits })
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);

    if (!subscription) {
        if (process.env.NODE_ENV === 'development') {
            return 1000; // Bypass for development
        }
        throw new Error('No active subscription found for user');
    }

    if (process.env.NODE_ENV === 'development') {
        return Math.max(1000, subscription.credits || 0);
    }

    return subscription.credits || 0;
}

/**
 * Gets the current Sarvagya credit balance and total monthly quota for a user.
 */
export async function getCreditBalance(userId: string): Promise<{ credits: number, monthlyQuota: number }> {
    const [subscription] = await db
        .select({
            credits: userSubscriptions.sarvagyaCredits,
            monthlyQuota: userSubscriptions.sarvagyaMonthlyQuota
        })
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);

    if (!subscription) {
        if (process.env.NODE_ENV === 'development') {
            return { credits: 1000, monthlyQuota: 1000 };
        }
        return { credits: 0, monthlyQuota: 0 };
    }

    if (process.env.NODE_ENV === 'development') {
        return {
            credits: Math.max(1000, subscription.credits || 0),
            monthlyQuota: Math.max(1000, subscription.monthlyQuota || 0)
        };
    }

    return { credits: subscription.credits || 0, monthlyQuota: subscription.monthlyQuota || 0 };
}

/**
 * Securely decrements a user's credit balance and logs the transaction.
 * Fails if the user doesn't have enough credits (concurrent race condition protection).
 */
export async function deductSarvagyaCredits(
    userId: string,
    amount: number,
    queryId: string
): Promise<void> {
    await db.transaction(async (tx) => {
        // The conditional WHERE is the concurrency guard: the row only matches
        // while the balance is still sufficient. node-postgres returns a
        // QueryResult (not a [rows, fields] tuple), so read `rowCount`.
        const updateResult = await tx
            .update(userSubscriptions)
            .set({
                sarvagyaCredits: sql`${userSubscriptions.sarvagyaCredits} - ${amount}`
            })
            .where(
                sql`${userSubscriptions.userId} = ${userId} AND ${userSubscriptions.sarvagyaCredits} >= ${amount}`
            );

        if ((updateResult as any).rowCount === 0) {
            if (process.env.NODE_ENV === 'development') {
                return; // Bypass deduction for dev testing
            }
            throw new Error('Insufficient credits or subscription not found');
        }

        await tx.insert(sarvagyaCreditTransactions).values({
            userId,
            amount: -amount,
            type: 'query_debit',
            reason: `Query executed (ID: ${queryId})`,
        });
    });
}

/**
 * Grants credits to a user (from a monthly refresh or an add-on purchase).
 */
export async function grantSarvagyaCredits(
    userId: string,
    amount: number,
    source: 'plan_grant' | 'topup_purchase',
    paymentId?: string
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .update(userSubscriptions)
            .set({
                sarvagyaCredits: sql`${userSubscriptions.sarvagyaCredits} + ${amount}`
            })
            .where(eq(userSubscriptions.userId, userId));

        await tx.insert(sarvagyaCreditTransactions).values({
            userId,
            amount: Math.abs(amount),
            type: source,
            reason: paymentId ? `Payment ID: ${paymentId}` : `Monthly Auto-refresh`,
        });
    });
}

/**
 * Resets the monthly credits for all active subscriptions where
 * `last_credits_reset` is older than 30 days. Uses a raw database operation
 * optimized for bulk execution.
 */
export async function resetMonthlyCredits(): Promise<number> {
    const result = await db.execute(sql`
        UPDATE user_subscriptions
        SET 
            sarvagya_credits = sarvagya_monthly_quota,
            last_credits_reset = NOW()
        WHERE 
            subscription_status = 'active' 
            AND (last_credits_reset IS NULL OR last_credits_reset < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `);

    // mysql2 returns [ResultSetHeader, FieldPacket[]]
    return (result as any)[0]?.affectedRows || 0;
}
