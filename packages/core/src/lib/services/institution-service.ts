
import { db } from '@/db';
import { 
    institutionProfiles, 
    institutionClasses, 
    institutionSections, 
    studentEnrollments 
} from '@/db/schema';
import { auth } from '@/auth';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getRedisCacheService } from '@/lib/services/redis_cache_service';

export const InstitutionTypeEnum = z.enum(['school', 'college', 'tuition_center']);

export interface CreateInstitutionParams {
    name: string;
    slug: string;
    type: z.infer<typeof InstitutionTypeEnum>;
    userId: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
}

export interface BrandingData {
    primaryColor?: string;
    logoUrl?: string;
    bannerUrl?: string;
}

/**
 * Service to manage Institution entities and their academic hierarchy
 */
export class InstitutionService {
    
    private static get cacheKeyPrefix() {
        return 'institution_profile:';
    }

    /**
     * Create a new institution. This creates the BetterAuth organization
     * and the corresponding institutionProfile record.
     */
    static async createInstitution(params: CreateInstitutionParams) {
        logger.info(`Creating institution: ${params.name}`, { userId: params.userId, slug: params.slug });
        
        try {
            // 1. Create Organization via Better Auth API
            const org = await auth.api.createOrganization({
                body: {
                    name: params.name,
                    slug: params.slug,
                    metadata: { type: params.type }
                },
                headers: new Headers() 
            });

            if (!org) {
                throw new Error('Failed to create organization via Better Auth');
            }

            // 2. Create the Institution Profile extension record
            await db.insert(institutionProfiles).values({
                id: crypto.randomUUID(),
                organizationId: org.id,
                type: params.type,
                address: params.address,
                contactEmail: params.contactEmail,
                contactPhone: params.contactPhone,
                onboardingCompleted: false
            });

            // 3. Make the creator the owner
            await auth.api.addMember({
                body: {
                    organizationId: org.id,
                    userId: params.userId,
                    role: 'owner',
                },
                headers: new Headers()
            });

            logger.info(`Institution created successfully: ${org.id}`);
            return org;
            
        } catch (error) {
        // @ts-ignore
            logger.error(`Error creating institution: ${params.name}`, error);
            throw error;
        }
    }

    /**
     * Retrieves the comprehensive profile of an institution, heavily cached via Redis
     */
    static async getInstitutionProfile(orgId: string) {
        const cache = getRedisCacheService();
        const cacheKey = `${this.cacheKeyPrefix}${orgId}`;
        
        try {
            const cachedProfile = await cache.get<any>(cacheKey);
            if (cachedProfile) {
                return cachedProfile;
            }
        } catch (err) {
        // @ts-ignore
            logger.error(`Redis cache read failed for org ${orgId}`, err);
        }

        const profile = await db.query.institutionProfiles.findFirst({
            where: eq(institutionProfiles.organizationId, orgId)
        });

        // Get basic org details from BetterAuth (optional, might sit in memory cache)
        const orgInfo = await auth.api.getFullOrganization({
            query: { organizationId: orgId },
            headers: new Headers()
        });

        const fullProfile = {
            ...orgInfo,
            profile
        };

        try {
            // Cache for 1 hour
            await cache.set(cacheKey, fullProfile, { ttl: 3600 });
        } catch (err) {
        // @ts-ignore
            logger.error(`Redis cache write failed for org ${orgId}`, err);
        }

        return fullProfile;
    }

    /**
     * Update branding properties of an institution
     */
    static async updateBranding(orgId: string, data: BrandingData) {
        logger.info(`Updating branding for org: ${orgId}`);
        
        const result = await db.update(institutionProfiles)
            .set({
                primaryColor: data.primaryColor,
                logoUrl: data.logoUrl,
                bannerUrl: data.bannerUrl,
                updatedAt: new Date()
            })
            .where(eq(institutionProfiles.organizationId, orgId));

        // If logo is updated, sync it back to BetterAuth organization table
        if (data.logoUrl) {
            await auth.api.updateOrganization({
                body: {
                    organizationId: orgId,
        // @ts-ignore
                    logo: data.logoUrl
                },
                headers: new Headers()
            });
        }

        // Invalidate cache
        await getRedisCacheService().delete(`${this.cacheKeyPrefix}${orgId}`);

        return result;
    }

    /**
     * Mark onboarding as completed
     */
    static async completeOnboarding(orgId: string) {
        logger.info(`Marking onboarding complete for org: ${orgId}`);
        const res = await db.update(institutionProfiles)
            .set({ onboardingCompleted: true, updatedAt: new Date() })
            .where(eq(institutionProfiles.organizationId, orgId));
            
        // Invalidate cache
        await getRedisCacheService().delete(`${this.cacheKeyPrefix}${orgId}`);
        return res;
    }
}

