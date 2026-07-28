import { eq, isNull, sql } from 'drizzle-orm';
import { db } from '../src/db';
import * as schema from '../src/db/schema';
import { logger } from '../src/lib/logger';

/**
 * Migration Data Backfill Script (Phase 1)
 * 
 * Purpose: Backfills the new `organizationId` column in all data tables.
 * Strategy:
 * 1. Read the legacy `tenantId` from the `users` table for each record's owner.
 * 2. Set the data table's `organizationId` matching the owner's legacy `tenantId`.
 * 3. Log results and dry-run mode capabilities.
 * 
 * USAGE: 
 * DRY RUN: npx tsx scripts/migrate-tenant-data.ts
 * EXECUTE: EXECUTE_MIGRATION=true npx tsx scripts/migrate-tenant-data.ts
 */

const DRY_RUN = process.env.EXECUTE_MIGRATION !== 'true';

async function mapUserToOrg(tablesToUpdate: any[]) {
  logger.info(`Starting organizationId backfill migration. Configuration: DRY_RUN=${DRY_RUN}`);
  
  try {
    // We assume most tables have a `userId` or `authorId` linking to `users`
    // If a table uses a different column to link to user, map it here.
    const userLinkingColumnMap: Record<string, keyof typeof schema> = {
      default: 'userId' as any,
      materials: 'uploadedBy' as any,
      practestTestConfigurations: 'createdBy' as any,
      practestTestSessions: 'studentId' as any,
      adminActivityLog: 'adminId' as any,
      // Add other explicit mappings if necessary
    };

    for (const table of tablesToUpdate) {
      const dbTable = (schema as any)[table];
      if (!dbTable) {
        logger.warn(`Table ${table} not found in schema. Skipping.`);
        continue;
      }

      const linkingColumnName = userLinkingColumnMap[table] || userLinkingColumnMap.default;
      const linkingColumn = dbTable[linkingColumnName];
      
      if (!linkingColumn) {
        logger.warn(`Linking column ${String(linkingColumnName)} not found in table ${table}. Skipping.`);
        continue;
      }

      if (DRY_RUN) {
        // Just count how many records need updating
        const recordsToUpdate = await db
          .select({ count: sql<number>`cast(count(*) as unsigned)` })
          .from(dbTable)
          .where(isNull(dbTable.organizationId));
        
        logger.info(`[DRY RUN] Table ${table}: ${recordsToUpdate[0]?.count || 0} records missing organizationId.`);
      } else {
        // Execute the UPDATE statement
        // UPDATE table t SET organizationId = (SELECT tenantId FROM users u WHERE u.id = t.userId) WHERE t.organizationId IS NULL
        logger.info(`Executing backfill for table: ${table}...`);
        
        const result = await db.execute(sql`
          UPDATE ${dbTable} t
          JOIN ${schema.users} u ON u.id = t.${linkingColumn}
          SET t.organizationId = u.tenantId
          WHERE t.organizationId IS NULL
        `);
        
        logger.info(`Updated records in ${table}:`, result);
      }
    }

    logger.info('Migration backfill completed successfully.');

  } catch (error) {
    logger.error('Error during migration backfill:', error);
    process.exit(1);
  }
}

// List of tables updated with organizationId
const tablesToBackfill = [
  'enhancedUserProfiles',
  'subscriptionPlans',
  'userSubscriptions',
  'aiTutorUsage',
  'freeTrials',
  'subscriptionHistory',
  'quotaAlerts',
  'notifications',
  'materials',
  'googleDriveFolders',
  'materialApprovalLog',
  'googleDriveConfig',
  'adminActivityLog',
  'userMaterialAccess',
  'practestQuestionBank',
  'practestTestConfigurations',
  'practestTestSessions',
  'userNotes',
  'noteFolders',
  'noteShares',
  'noteActivityLog',
  'noteTemplates',
  'dictionaryWords',
  'userVocabProgress',
  'communityPhrases',
  'dictionaryUserStats',
  'dictionarySearchHistory',
  'dictionaryOfflineSync',
  'sarvagyaCreditTransactions',
  'sarvagyaSpaces',
  'sarvagyaDocuments',
  'sarvagyaQueries',
  'answerFeedback'
];

mapUserToOrg(tablesToBackfill);
