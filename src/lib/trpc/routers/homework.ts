import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, teacherProcedure, studentProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

// Types
export interface Homework {
  id: string
  tenant_id: string
  class_id: string
  teacher_id: string
  title: string
  description?: string
  due_date: Date
  created_at: Date
  updated_at: Date
  teacher_name?: string
  // Added dynamically for students
  is_submitted?: boolean
}

export interface HomeworkSubmission {
  id: string
  tenant_id: string
  homework_id: string
  student_id: string
  status: 'completed'
  submitted_at: Date
  student_name?: string
}

// Schemas
const createHomeworkSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  dueDate: z.date(),
})

const getHomeworksSchema = z.object({
  classId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export const homeworkRouter = createTRPCRouter({
  /**
   * Create new homework
   */
  createHomework: teacherProcedure
    .input(createHomeworkSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Check feature flag
      const featureCheck = await executeQuerySingle<{ enable_homework: number }>(
        `SELECT enable_homework FROM tenant_features WHERE tenant_id = ?`,
        [ctx.tenantId]
      )
      if (!featureCheck?.enable_homework) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Homework feature is disabled for this organization' })
      }

      // 2. Validate class belongs to tenant
      const { classId, title, description, dueDate } = input;
      const classValidation = await executeQuerySingle<{ id: string }>(
        `SELECT id FROM classes WHERE id = ? AND tenant_id = ?`,
        [classId, ctx.tenantId]
      );
      if (!classValidation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Class not found' })
      }

      // 3. Insert homework
      const sql = `
        INSERT INTO homeworks (tenant_id, class_id, teacher_id, title, description, due_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await executeQuery(sql, [
        ctx.tenantId,
        classId,
        ctx.userId,
        title,
        description,
        dueDate
      ]);

      return { success: true }
    }),

  /**
   * Get homeworks for a specific class
   */
  getHomeworksForClass: protectedProcedure
    .input(getHomeworksSchema)
    .query(async ({ input, ctx }) => {
      // 1. Check feature flag
      const featureCheck = await executeQuerySingle<{ enable_homework: number }>(
        `SELECT enable_homework FROM tenant_features WHERE tenant_id = ?`,
        [ctx.tenantId]
      )
      if (!featureCheck?.enable_homework) {
        return { homeworks: [], total: 0 } 
      }

      // Base query
      let sql = `
        SELECT 
          h.id, h.tenant_id, h.class_id, h.teacher_id, h.title, h.description, h.due_date,
          h.created_at, h.updated_at,
          u.name as teacher_name
      `;

      // If student, check submissions
      if (ctx.userRole === 'student') {
        sql += `, CASE WHEN hs.id IS NOT NULL THEN 1 ELSE 0 END as is_submitted `;
      }

      sql += `
        FROM homeworks h
        LEFT JOIN users u ON h.teacher_id = u.id
      `;

      if (ctx.userRole === 'student') {
        sql += ` LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ? `;
      }

      sql += `
        WHERE h.tenant_id = ? AND h.class_id = ?
        ORDER BY h.due_date DESC
        LIMIT ? OFFSET ?
      `;

      const params = ctx.userRole === 'student' 
        ? [ctx.userId, ctx.tenantId, input.classId, input.limit, input.offset]
        : [ctx.tenantId, input.classId, input.limit, input.offset];

      const rows = await executeQuery<any>(sql, params);

      const countSql = `SELECT COUNT(*) as total FROM homeworks WHERE tenant_id = ? AND class_id = ?`;
      const totalResult = await executeQuerySingle<{ total: number }>(countSql, [ctx.tenantId, input.classId]);

      return {
        homeworks: rows.map(r => ({
          ...r,
          is_submitted: r.is_submitted !== undefined ? !!r.is_submitted : undefined
        })) as Homework[],
        total: totalResult?.total || 0,
      }
    }),

  /**
   * Get homeworks for the currently logged-in student (auto-detects class)
   */
  getMyHomeworks: studentProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      // 1. Check feature flag
      const featureCheck = await executeQuerySingle<{ enable_homework: number }>(
        `SELECT enable_homework FROM tenant_features WHERE tenant_id = ?`,
        [ctx.tenantId]
      )
      if (!featureCheck?.enable_homework) {
        return { homeworks: [], total: 0 } 
      }

      // 2. Get student's class_id
      const student = await executeQuerySingle<{ class_id: string }>(
        `SELECT class_id FROM \`users\` WHERE id = ?`,
        [ctx.userId]
      );
      
      if (!student?.class_id) {
        return { homeworks: [], total: 0 } 
      }

      const sql = `
        SELECT 
          h.id, h.tenant_id, h.class_id, h.teacher_id, h.title, h.description, h.due_date,
          h.created_at, h.updated_at,
          u.name as teacher_name,
          CASE WHEN hs.id IS NOT NULL THEN 1 ELSE 0 END as is_submitted
        FROM homeworks h
        LEFT JOIN users u ON h.teacher_id = u.id
        LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ?
        WHERE h.tenant_id = ? AND h.class_id = ?
        ORDER BY h.due_date DESC
        LIMIT ? OFFSET ?
      `;

      const rows = await executeQuery<any>(sql, [ctx.userId, ctx.tenantId, student.class_id, input.limit, input.offset]);

      return {
        homeworks: rows.map(r => ({
          ...r,
          is_submitted: !!r.is_submitted
        })) as Homework[],
        total: rows.length,
      }
    }),

  /**
   * Student submits homework (marks as done)
   * Sparse model: simply inserts a row into homework_submissions
   */
  submitHomework: studentProcedure
    .input(z.object({ homeworkId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // 1. Feature check
      const featureCheck = await executeQuerySingle<{ enable_homework: number }>(
        `SELECT enable_homework FROM tenant_features WHERE tenant_id = ?`,
        [ctx.tenantId]
      )
      if (!featureCheck?.enable_homework) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Homework feature disabled' })
      }

      // 2. Validate homework exists & belongs to tenant
      const hw = await executeQuerySingle<{ id: string }>(
        `SELECT id FROM homeworks WHERE id = ? AND tenant_id = ?`,
        [input.homeworkId, ctx.tenantId]
      )
      if (!hw) throw new TRPCError({ code: 'NOT_FOUND', message: 'Homework not found' })

      // 3. Mark as done (Insert ignore logic handled by try-catch for uniqueness)
      try {
        await executeQuery(
          `INSERT INTO homework_submissions (tenant_id, homework_id, student_id) VALUES (?, ?, ?)`,
          [ctx.tenantId, input.homeworkId, ctx.userId]
        )
      } catch (e: any) {
        // If Duplicate Entry, it means they already submitted
        if (e.code === 'ER_DUP_ENTRY') {
          return { success: true, message: 'Already marked as completed' }
        }
        throw e;
      }

      return { success: true }
    }),

  /**
   * Teacher gets all submissions for a homework
   */
  getHomeworkSubmissions: teacherProcedure
    .input(z.object({ homeworkId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const sql = `
        SELECT 
          hs.id, hs.tenant_id, hs.homework_id, hs.student_id, hs.status, hs.submitted_at,
          u.name as student_name
        FROM homework_submissions hs
        JOIN users u ON hs.student_id = u.id
        WHERE hs.tenant_id = ? AND hs.homework_id = ?
        ORDER BY hs.submitted_at DESC
      `;
      const submissions = await executeQuery<HomeworkSubmission>(sql, [ctx.tenantId, input.homeworkId]);
      return { submissions }
    }),

  /**
   * Delete homework
   */
  deleteHomework: teacherProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const hw = await executeQuerySingle<{ created_by?: string, teacher_id: string }>(
        `SELECT teacher_id FROM homeworks WHERE id = ? AND tenant_id = ?`,
        [input.id, ctx.tenantId]
      );

      if (!hw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Homework not found' });
      }

      if (ctx.userRole === 'teacher' && hw.teacher_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own homeworks' });
      }

      await executeQuery(`DELETE FROM homeworks WHERE id = ?`, [input.id]);
      return { success: true };
    }),
});
