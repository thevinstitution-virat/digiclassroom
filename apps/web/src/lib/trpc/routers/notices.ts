import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, teacherProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

// Types
export interface Notice {
  id: string
  tenant_id: string
  target_audience: 'all' | 'students' | 'teachers'
  title: string
  content: string
  created_by: string
  created_at: Date
  updated_at: Date
  author_name?: string
}

// Schemas
const createNoticeSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
  targetAudience: z.enum(['all', 'students', 'teachers']).default('all'),
})

const getNoticesSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export const noticesRouter = createTRPCRouter({
  /**
   * Create a new notice
   * Restricted to teachers and admins
   */
  createNotice: teacherProcedure
    .input(createNoticeSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Check feature flag
      const featureCheck = await executeQuerySingle<{ enable_notices: number }>(
        `SELECT enable_notices FROM tenant_features WHERE tenant_id = ?`,
        [ctx.tenantId]
      )
      if (!featureCheck?.enable_notices) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Notices feature is disabled for this organization' })
      }

      // 2. Insert notice
      const { title, content, targetAudience } = input;
      const sql = `
        INSERT INTO notices (tenant_id, target_audience, title, content, created_by)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await executeQuery(sql, [
        ctx.tenantId,
        targetAudience,
        title,
        content,
        ctx.userId
      ]);

      return { success: true }
    }),

  /**
   * Get notices for the current tenant and user's role
   */
  getNotices: protectedProcedure
    .input(getNoticesSchema)
    .query(async ({ input, ctx }) => {
      // 1. Check feature flag
      const featureCheck = await executeQuerySingle<{ enable_notices: number }>(
        `SELECT enable_notices FROM tenant_features WHERE tenant_id = ?`,
        [ctx.tenantId]
      )
      if (!featureCheck?.enable_notices) {
        return { notices: [], total: 0 } // Return empty if disabled
      }

      // 2. Determine allowed audiences based on role
      let audiences = ["'all'"];
      if (ctx.userRole === 'student' || ctx.userRole === 'parent') {
        audiences.push("'students'");
      } else if (ctx.userRole === 'teacher' || ctx.userRole === 'admin' || ctx.userRole === 'super_admin') {
        audiences.push("'students'");
        audiences.push("'teachers'");
      }

      const sql = `
        SELECT 
          n.id, n.tenant_id, n.target_audience, n.title, n.content, 
          n.created_by, n.created_at, n.updated_at,
          u.name as author_name
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        WHERE n.tenant_id = ? 
          AND n.target_audience IN (${audiences.join(',')})
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const notices = await executeQuery<Notice>(sql, [ctx.tenantId, input.limit, input.offset]);

      const countSql = `
        SELECT COUNT(*) as total 
        FROM notices 
        WHERE tenant_id = ? 
          AND target_audience IN (${audiences.join(',')})
      `;
      const totalResult = await executeQuerySingle<{ total: number }>(countSql, [ctx.tenantId]);

      return {
        notices,
        total: totalResult?.total || 0,
      }
    }),

  /**
   * Delete a notice
   */
  deleteNotice: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Admin can delete any, teacher can only delete their own
      const notice = await executeQuerySingle<Notice>(
        `SELECT id, created_by FROM notices WHERE id = ? AND tenant_id = ?`,
        [input.id, ctx.tenantId]
      );

      if (!notice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notice not found' });
      }

      if (ctx.userRole === 'teacher' && notice.created_by !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own notices' });
      }

      await executeQuery(`DELETE FROM notices WHERE id = ?`, [input.id]);
      return { success: true };
    }),
});
