import { db } from '@/db';
import { eq, and, SQL } from 'drizzle-orm';
import * as schema from '@/db/schema';

/**
 * Creates a scoped query builder for a specific organization.
 * Used to strictly enforce row-level tenant isolation in the data access layer.
 * 
 * Usage:
 * const orgDb = scopedQuery(orgId);
 * const notes = await orgDb.notes();
 */
export function scopedQuery(orgId: string) {
    if (!orgId) {
        throw new Error("FATAL: scopedQuery requires a valid organizationId to prevent cross-tenant data leaks.");
    }

    return {
        // --- Core Content ---
        materials: () => db.select().from(schema.materials).where(eq(schema.materials.organizationId, orgId)),
        practestQuestionBank: () => db.select().from(schema.practestQuestionBank).where(eq(schema.practestQuestionBank.organizationId, orgId)),
        practestTestConfigurations: () => db.select().from(schema.practestTestConfigurations).where(eq(schema.practestTestConfigurations.organizationId, orgId)),
        
        // --- Users & Profiles ---
        userProfiles: () => db.select().from(schema.enhancedUserProfiles).where(eq(schema.enhancedUserProfiles.organizationId, orgId)),
        
        // --- Academic Hierarchy ---
        classes: () => db.select().from(schema.institutionClasses).where(eq(schema.institutionClasses.organizationId, orgId)),
        sections: () => db.select().from(schema.institutionSections).where(eq(schema.institutionSections.organizationId, orgId)),
        enrollments: () => db.select().from(schema.studentEnrollments).where(eq(schema.studentEnrollments.organizationId, orgId)),
        
        // --- Notes & Folders ---
        notes: () => db.select().from(schema.userNotes).where(eq(schema.userNotes.organizationId, orgId)),
        noteFolders: () => db.select().from(schema.noteFolders).where(eq(schema.noteFolders.organizationId, orgId)),
        
        // --- AI Auth & Usage ---
        sarvagyaSpaces: () => db.select().from(schema.sarvagyaSpaces).where(eq(schema.sarvagyaSpaces.organizationId, orgId)),
        aiTutorUsage: () => db.select().from(schema.aiTutorUsage).where(eq(schema.aiTutorUsage.organizationId, orgId)),

        // --- Subscriptions & Notifications (D7) ---
        userSubscriptions: () =>
            db.select().from(schema.userSubscriptions).where(eq(schema.userSubscriptions.organizationId, orgId)),
        userSubscriptionByUserId: (userId: string) =>
            db.select().from(schema.userSubscriptions).where(
                and(
                    eq(schema.userSubscriptions.organizationId, orgId),
                    eq(schema.userSubscriptions.userId, userId),
                ),
            ).limit(1),
        notifications: () =>
            db.select().from(schema.notifications).where(eq(schema.notifications.organizationId, orgId)),
        notificationsByUserId: (userId: string) =>
            db.select().from(schema.notifications).where(
                and(
                    eq(schema.notifications.organizationId, orgId),
                    eq(schema.notifications.userId, userId),
                ),
            ),

        // --- Generic where conditions ---
        /** 
         * Helper to append an organization filter to any custom Drizzle condition for complex queries.
         * Usage: 
         * const orgDb = scopedQuery(orgId);
         * await db.update(materials).set({...}).where(orgDb.whereOrg(materials, eq(materials.id, id)));
         */
        whereOrg: (table: any, condition?: SQL | undefined) => {
            const orgFilter = eq(table.organizationId, orgId);
            return condition ? and(orgFilter, condition) : orgFilter;
        }
    };
}
