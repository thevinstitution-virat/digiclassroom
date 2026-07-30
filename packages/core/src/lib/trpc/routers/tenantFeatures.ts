import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, superAdminProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

// Type definition for Tenant Features
export interface TenantFeatures {
  tenant_id: string
  enable_live_classes: boolean
  enable_video_library: boolean
  enable_homework: boolean
  enable_notices: boolean
  enable_doubts: boolean
  teacher_can_upload_videos: boolean
  teacher_can_schedule_live: boolean
  admin_can_manage_zoom: boolean
  created_at?: Date
  updated_at?: Date
}

// Default fallback when row doesn't exist
const DEFAULT_FEATURES: TenantFeatures = {
  tenant_id: '',
  enable_live_classes: false,
  enable_video_library: false,
  enable_homework: false,
  enable_notices: false,
  enable_doubts: false,
  teacher_can_upload_videos: false,
  teacher_can_schedule_live: false,
  admin_can_manage_zoom: true,
}

// Validation schemas
const getFeaturesSchema = z.object({
  tenantId: z.string().uuid().optional(),
})

const updateFeaturesSchema = z.object({
  tenantId: z.string().uuid(),
  features: z.object({
    enable_live_classes: z.boolean().optional(),
    enable_video_library: z.boolean().optional(),
    enable_homework: z.boolean().optional(),
    enable_notices: z.boolean().optional(),
    enable_doubts: z.boolean().optional(),
    teacher_can_upload_videos: z.boolean().optional(),
    teacher_can_schedule_live: z.boolean().optional(),
    admin_can_manage_zoom: z.boolean().optional(),
  })
})

export const tenantFeaturesRouter = createTRPCRouter({
  /**
   * Get features for a specific tenant.
   * If tenantId is not provided, uses the authenticated user's tenantId.
   */
  getFeatures: protectedProcedure
    .input(getFeaturesSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Resolve target tenant: must be super_admin to query arbitrary tenant
        let targetTenantId = ctx.tenantId;
        if (input.tenantId && input.tenantId !== ctx.tenantId) {
          if (ctx.userRole !== 'super_admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Only super_admin can query features for other tenants'
            });
          }
          targetTenantId = input.tenantId;
        }

        if (!targetTenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID required' });
        }

        const sql = `
          SELECT 
            tenant_id, 
            enable_live_classes, 
            enable_video_library, 
            enable_homework, 
            enable_notices, 
            enable_doubts,
            teacher_can_upload_videos,
            teacher_can_schedule_live,
            admin_can_manage_zoom,
            created_at,
            updated_at
          FROM tenant_features 
          WHERE tenant_id = ?
        `;
        
        const row = await executeQuerySingle<TenantFeatures>(sql, [targetTenantId]);
        
        if (!row) {
          return {
            ...DEFAULT_FEATURES,
            tenant_id: targetTenantId,
          };
        }
        
        // Convert integer booleans from DB if necessary
        return {
          ...row,
          enable_live_classes: !!row.enable_live_classes,
          enable_video_library: !!row.enable_video_library,
          enable_homework: !!row.enable_homework,
          enable_notices: !!row.enable_notices,
          enable_doubts: !!row.enable_doubts,
          teacher_can_upload_videos: !!row.teacher_can_upload_videos,
          teacher_can_schedule_live: !!row.teacher_can_schedule_live,
          admin_can_manage_zoom: !!row.admin_can_manage_zoom,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('getFeatures error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch tenant features'
        });
      }
    }),

  getAllTenantsWithFeatures: superAdminProcedure
    .query(async () => {
      const sql = `
        SELECT 
          t.id as tenant_id,
          t.name as tenant_name,
          0 as enable_live_classes,
          0 as enable_video_library,
          0 as enable_homework,
          0 as enable_notices,
          0 as enable_doubts,
          0 as teacher_can_upload_videos,
          0 as teacher_can_schedule_live,
          1 as admin_can_manage_zoom
        FROM organization t
        ORDER BY t.created_at DESC
      `;
      
      const rows = await executeQuery<any>(sql, []);
      
      return rows.map(row => ({
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        enable_live_classes: !!row.enable_live_classes,
        enable_video_library: !!row.enable_video_library,
        enable_homework: !!row.enable_homework,
        enable_notices: !!row.enable_notices,
        enable_doubts: !!row.enable_doubts,
        teacher_can_upload_videos: !!row.teacher_can_upload_videos,
        teacher_can_schedule_live: !!row.teacher_can_schedule_live,
        admin_can_manage_zoom: !!row.admin_can_manage_zoom,
      }));
    }),

  /**
   * Update features for a specific tenant.
   * Super Admins only.
   */
  updateFeatures: protectedProcedure
    .input(updateFeaturesSchema)
    .mutation(async ({ input, ctx }) => {
      // Must be super admin
      if (ctx.userRole !== 'super_admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only super_admin can update tenant features'
        });
      }

      try {
        const { tenantId, features } = input;

        // First check if a row exists
        const checkSql = `SELECT tenant_id FROM tenant_features WHERE tenant_id = ?`;
        const exists = await executeQuerySingle<{ tenant_id: string }>(checkSql, [tenantId]);

        if (exists) {
          // Update existing row
          const updates: string[] = [];
          const values: any[] = [];
          
          Object.entries(features).forEach(([key, val]) => {
            if (val !== undefined) {
              updates.push(`${key} = ?`);
              values.push(Boolean(val));
            }
          });
          
          if (updates.length > 0) {
            values.push(tenantId);
            const updateSql = `UPDATE tenant_features SET ${updates.join(', ')} WHERE tenant_id = ?`;
            await executeQuery(updateSql, values);
          }
        } else {
          // Insert new row
          const insertSql = `
            INSERT INTO tenant_features (
              tenant_id, 
              enable_live_classes, 
              enable_video_library, 
              enable_homework, 
              enable_notices, 
              enable_doubts,
              teacher_can_upload_videos,
              teacher_can_schedule_live,
              admin_can_manage_zoom
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await executeQuery(insertSql, [
            tenantId,
            Boolean(features.enable_live_classes),
            Boolean(features.enable_video_library),
            Boolean(features.enable_homework),
            Boolean(features.enable_notices),
            Boolean(features.enable_doubts),
            Boolean(features.teacher_can_upload_videos),
            Boolean(features.teacher_can_schedule_live),
            features.admin_can_manage_zoom !== false, // Default true
          ]);
        }

        // Return the updated row
        const rowSql = `SELECT * FROM tenant_features WHERE tenant_id = ?`;
        const updatedRow = await executeQuerySingle<TenantFeatures>(rowSql, [tenantId]);
        
        if (!updatedRow) throw new Error("Failed to retrieve updated row");

        return {
          ...updatedRow,
          enable_live_classes: !!updatedRow.enable_live_classes,
          enable_video_library: !!updatedRow.enable_video_library,
          enable_homework: !!updatedRow.enable_homework,
          enable_notices: !!updatedRow.enable_notices,
          enable_doubts: !!updatedRow.enable_doubts,
          teacher_can_upload_videos: !!updatedRow.teacher_can_upload_videos,
          teacher_can_schedule_live: !!updatedRow.teacher_can_schedule_live,
          admin_can_manage_zoom: !!updatedRow.admin_can_manage_zoom,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('updateFeatures error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update tenant features'
        });
      }
    }),
});
