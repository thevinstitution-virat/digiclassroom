import { logger } from '@/lib/logger';

import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.langfuse.com',
});

// Production limit per day. Defaults to 50 USD if not defined
const DAILY_LIMIT = parseFloat(process.env.DAILY_COST_ALERT_USD || '50.0');

export class StudentCostMonitor {
    /**
     * Evaluates if we are over our daily maximum budget.
     * Runs async, failure will NOT block the application (Fail Open pattern)
     */
    static async checkDailyBudget(): Promise<{
        safe: boolean;
        currentCost: number;
        limit: number
    }> {
        try {
            if (!process.env.LANGFUSE_SECRET_KEY) {
                return { safe: true, currentCost: 0, limit: DAILY_LIMIT };
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get metrics from Langfuse via raw REST API since Node SDK is for ingestion
            const headers = {
                'Authorization': 'Basic ' + Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64'),
                'Content-Type': 'application/json'
            };

            const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.langfuse.com';
            const url = `${baseUrl}/api/public/metrics/daily?fromTimestamp=${today.toISOString()}`;

            const res = await fetch(url, { headers });

            let totalCost = 0;
            if (res.ok) {
                const data = await res.json();
                // Parse total cost from Langfuse metrics structure 
                if (data && data.data) {
        // @ts-ignore
                    totalCost = data.data.reduce((sum: number, item: unknown) => sum + (item.totalCost || 0), 0);
                }
            }

            const safe = totalCost < DAILY_LIMIT;

            if (!safe) {
                logger.error(`🚨 BUDGET ALERT: Daily AI cost (${totalCost.toFixed(2)} USD) exceeded limit of ${DAILY_LIMIT.toFixed(2)} USD!`);
                // We could theoretically fire off an email or Slack webhook here
            }

            return {
                safe,
                currentCost: totalCost,
                limit: DAILY_LIMIT
            };
        } catch (error) {
        // @ts-ignore
            logger.warn({ error: error }, '⚠️ Cost Monitor failed to reach Langfuse. Failing OPEN.');
            // Fail open so students don't get blocked by an observability outage
            return { safe: true, currentCost: 0, limit: DAILY_LIMIT };
        }
    }

    /**
     * Check if a specific user is burning through an unusual amount of tokens
     */
    static async isUserAnomalous(userId: string): Promise<boolean> {
        // A placeholder for more complex anti-abuse logic per student
        // Could involve reading a secondary Redis counter specifically for token burn rate
        return false;
    }
}
