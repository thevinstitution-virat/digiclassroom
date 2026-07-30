import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, teacherProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { TRPCError } from '@trpc/server'
import { decrypt } from '@/lib/encryption'
import crypto from 'crypto'

export const liveClassesRouter = createTRPCRouter({
  // Schedule a new live class
  schedule: protectedProcedure
    .input(z.object({
      classId: z.string(),
      title: z.string(),
      scheduledStartTime: z.string(), // ISO date string
      durationMinutes: z.number().min(15).max(300),
      tenantId: z.string().optional() // required for super_admin
    }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.userRole;

      // --- Resolve and validate tenantId ---
      let tenantId: string;
      if (role === 'super_admin') {
        if (!input.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'tenantId required for super_admin' });
        tenantId = input.tenantId;
      } else {
        if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });
        tenantId = ctx.tenantId;
      }

      // --- Feature flag check ---
      const flags = await executeQuerySingle<any>(
        'SELECT * FROM tenant_features WHERE tenant_id = ?',
        [tenantId]
      );
      if (!flags?.enable_live_classes) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Live classes feature is disabled for this organization.' })
      }

      // --- Role-specific permission checks ---
      if (role === 'teacher') {
        if (!flags.teacher_can_schedule_live) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Teachers are not permitted to schedule live classes' });
        }
        // Verify classId belongs to this teacher
        const classCheck = await executeQuerySingle<{ id: string }>(
          `SELECT c.id FROM classes c 
           JOIN teacher_class_assignments tca ON c.id = tca.class_id 
           WHERE c.id = ? AND c.organization_id = ? AND tca.teacher_id = ? AND tca.is_active = TRUE`,
          [input.classId, tenantId, ctx.userId]
        );
        if (!classCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Class not found or not assigned to you' });
      } else if (role === 'admin') {
        // Verify classId belongs to their tenant
        const classCheck = await executeQuerySingle<{ id: string }>(
          'SELECT id FROM classes WHERE id = ? AND organization_id = ?',
          [input.classId, tenantId]
        );
        if (!classCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Class not found' });
      } else if (role === 'super_admin') {
        // Verify classId belongs to the specified tenantId
        const classCheck = await executeQuerySingle<{ id: string }>(
          'SELECT id FROM classes WHERE id = ? AND organization_id = ?',
          [input.classId, tenantId]
        );
        if (!classCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Class not found' });
      } else {
        // student or unknown role
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to schedule classes' });
      }

      // 1. Fetch Zoom Credentials for the Tenant
      const creds = await executeQuerySingle<{ account_id: string, client_id: string, client_secret: string, status: string }>(
        `SELECT account_id, client_id, client_secret, status FROM zoom_credentials WHERE tenant_id = ? AND status = 'active' LIMIT 1`,
        [tenantId]
      )

      if (!creds) {
        throw new TRPCError({ 
          code: 'PRECONDITION_FAILED', 
          message: 'Zoom integration is not configured for this organization.' 
        })
      }

      const accountId = decrypt(creds.account_id)
      const clientId = decrypt(creds.client_id)
      const clientSecret = decrypt(creds.client_secret)

      // 2. Authenticate with Zoom to get an access token
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const tokenResponse = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      if (!tokenResponse.ok) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to authenticate with Zoom' })
      }
      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token

      // 3. Create Meeting in Zoom
      const meetingResponse = await fetch(`https://api.zoom.us/v2/users/me/meetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: input.title,
          type: 2, // Scheduled meeting
          start_time: new Date(input.scheduledStartTime).toISOString(),
          duration: input.durationMinutes,
          timezone: 'UTC',
          settings: {
            host_video: true,
            participant_video: false,
            join_before_host: false,
            mute_upon_entry: true,
            waiting_room: true
          }
        })
      })

      if (!meetingResponse.ok) {
        const errorData = await meetingResponse.json()
        console.error('Zoom Meeting Creation Failed:', errorData)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create Zoom meeting' })
      }

      const meetingData = await meetingResponse.json()
      
      // 4. Save to Database
      const id = crypto.randomUUID()
      await executeQuery(
        `INSERT INTO live_classes (id, tenant_id, class_id, title, scheduled_start_time, duration_minutes, zoom_meeting_id, zoom_join_url, zoom_start_url, host_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
        [
          id, 
          tenantId, 
          input.classId, 
          input.title, 
          new Date(input.scheduledStartTime), 
          input.durationMinutes, 
          meetingData.id.toString(), 
          meetingData.join_url, 
          meetingData.start_url, 
          ctx.userId
        ]
      )

      return { success: true, meetingId: meetingData.id }
    }),

  // Get live classes for a specific class
  listByClass: protectedProcedure
    .input(z.object({ classId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let targetTenant = ctx.tenantId;
      if (ctx.userRole === 'super_admin' && input.tenantId) {
        targetTenant = input.tenantId;
      }
      if (!targetTenant) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' })

      const featureCheck = await executeQuerySingle<{ enable_live_classes: number }>(
        `SELECT enable_live_classes FROM tenant_features WHERE tenant_id = ?`,
        [targetTenant]
      )
      if (!featureCheck?.enable_live_classes) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Live classes feature is disabled for this organization.' })
      }

      const classes = await executeQuery<any>(
        `SELECT * FROM live_classes WHERE tenant_id = ? AND class_id = ? ORDER BY scheduled_start_time ASC`,
        [targetTenant, input.classId]
      )

      // Only teachers get the start_url. Students only get join_url.
      const isTeacher = ctx.userRole === 'teacher' || ctx.userRole === 'admin' || ctx.userRole === 'super_admin'

      return classes.map((c: any) => ({
        id: c.id,
        title: c.title,
        scheduledStartTime: c.scheduled_start_time,
        durationMinutes: c.duration_minutes,
        status: c.status,
        hostId: c.host_id,
        joinUrl: c.zoom_join_url,
        // Only return start_url if user is a teacher
        startUrl: isTeacher ? c.zoom_start_url : null
      }))
    })
})
