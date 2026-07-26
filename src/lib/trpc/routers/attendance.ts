import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, teacherProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

// Types
export interface AttendanceRecord {
  id: string
  tenant_id: string
  class_id: string
  user_id: string
  date: Date
  status: 'present' | 'absent' | 'late'
  type: 'regular' | 'live'
  created_by?: string
  student_name?: string
}

// Schemas
const markAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  type: z.enum(['regular', 'live']).default('regular'),
  records: z.array(z.object({
    userId: z.string().uuid(),
    status: z.enum(['present', 'absent', 'late'])
  }))
})

const getAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  type: z.enum(['regular', 'live']).default('regular')
})

const getStudentStatsSchema = z.object({
  classId: z.string().uuid(),
  userId: z.string().uuid().optional(), // Defaults to self if not provided
})

export const attendanceRouter = createTRPCRouter({
  /**
   * Batch mark attendance for a class
   * Creates or updates existing records for that date & type
   */
  markAttendance: teacherProcedure
    .input(markAttendanceSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Check feature flag (Live Classes or regular attendance feature?)
      // We don't have an explicit 'enable_attendance' flag in tenant_features.
      // But if it's 'live', check enable_live_classes.
      if (input.type === 'live') {
        const featureCheck = await executeQuerySingle<{ enable_live_classes: number }>(
          `SELECT enable_live_classes FROM tenant_features WHERE tenant_id = ?`,
          [ctx.tenantId]
        )
        if (!featureCheck?.enable_live_classes) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Live classes feature disabled' })
        }
      }

      const { classId, date, type, records } = input;
      if (records.length === 0) return { success: true };

      // 2. Validate that class belongs to tenant AND students belong to class
      const userIds = records.map(r => r.userId);
      const placeholders = userIds.map(() => '?').join(',');
      const validationSql = `
        SELECT u.id 
        FROM \`users\` u
        JOIN classes c ON u.class_id = c.id
        WHERE u.class_id = ? AND c.tenant_id = ? AND u.id IN (${placeholders})
      `;
      const validStudents = await executeQuery<{ id: string }>(validationSql, [classId, ctx.tenantId, ...userIds]);
      
      if (validStudents.length !== userIds.length) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'One or more students do not belong to the specified class or the class does not belong to this tenant' 
        });
      }

      // We'll do an UPSERT (ON DUPLICATE KEY UPDATE) for each record
      // In MySQL: INSERT INTO ... ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()
      
      const values = records.map(r => [
        ctx.tenantId, classId, r.userId, date, r.status, type, ctx.userId
      ]);

      const sql = `
        INSERT INTO attendance_records (tenant_id, class_id, user_id, date, status, type, created_by)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
          status = VALUES(status), 
          created_by = VALUES(created_by)
      `;

      await executeQuery(sql, [values]);

      return { success: true }
    }),

  /**
   * Get attendance records for a specific class and date
   */
  getAttendanceRecords: teacherProcedure
    .input(getAttendanceSchema)
    .query(async ({ input, ctx }) => {
      const sql = `
        SELECT 
          ar.id, ar.tenant_id, ar.class_id, ar.user_id, ar.date, ar.status, ar.type, ar.created_by,
          u.name as student_name
        FROM attendance_records ar
        JOIN users u ON ar.user_id = u.id
        WHERE ar.tenant_id = ? AND ar.class_id = ? AND ar.date = ? AND ar.type = ?
      `;

      const records = await executeQuery<AttendanceRecord>(sql, [
        ctx.tenantId, input.classId, input.date, input.type
      ]);

      return { records }
    }),

  /**
   * Get attendance stats for a student
   */
  getStudentAttendanceStats: protectedProcedure
    .input(getStudentStatsSchema)
    .query(async ({ input, ctx }) => {
      let targetUserId = input.userId || ctx.userId;

      // Security check: If querying another user, must be teacher/admin or parent
      if (targetUserId !== ctx.userId && ctx.userRole === 'student') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Students can only view their own attendance' })
      }

      const sql = `
        SELECT 
          COUNT(*) as total_days,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days
        FROM attendance_records
        WHERE tenant_id = ? AND class_id = ? AND user_id = ?
      `;

      const stats = await executeQuerySingle<any>(sql, [ctx.tenantId, input.classId, targetUserId]);

      const total = stats?.total_days || 0;
      const present = stats?.present_days || 0;
      const late = stats?.late_days || 0;
      const absent = stats?.absent_days || 0;

      // Consider late as half-present or fully present? Typically present for stats
      const percentage = total > 0 ? ((present + late) / total) * 100 : 0;

      return {
        total, present, late, absent,
        percentage: Math.round(percentage * 100) / 100
      }
    }),
});
