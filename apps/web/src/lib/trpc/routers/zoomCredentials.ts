import { z } from 'zod'
import { createTRPCRouter, adminProcedure, protectedProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { TRPCError } from '@trpc/server'
import { encrypt, decrypt } from '@/lib/encryption'

export const zoomCredentialsRouter = createTRPCRouter({
  // Admins and Super Admins can view the status of Zoom Credentials
  getStatus: adminProcedure
    .input(z.object({ tenantId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let tenantId: string;
      if (ctx.userRole === 'super_admin') {
        if (!input?.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'tenantId required for super_admin' });
        tenantId = input.tenantId;
      } else {
        if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });
        tenantId = ctx.tenantId;
        
        // Admin permission check
        const flags = await executeQuerySingle<any>('SELECT admin_can_manage_zoom FROM tenant_features WHERE tenant_id = ?', [tenantId]);
        if (!flags?.admin_can_manage_zoom) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admins are not permitted to manage Zoom credentials for this institution' });
        }
      }

      const creds = await executeQuerySingle<{ account_id: string, client_id: string, status: string }>(
        `SELECT account_id, client_id, status FROM zoom_credentials WHERE tenant_id = ? LIMIT 1`,
        [tenantId]
      )

      if (!creds) return null

      return {
        hasCredentials: true,
        accountId: creds.account_id,
        clientId: creds.client_id, // We don't decrypt account_id/client_id for UI display, we just show that they exist
        status: creds.status
      }
    }),

  // Save and Validate Zoom Credentials
  save: adminProcedure
    .input(z.object({
      accountId: z.string().min(1),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      tenantId: z.string().optional() // required for super_admin
    }))
    .mutation(async ({ ctx, input }) => {
      let tenantId: string;
      if (ctx.userRole === 'super_admin') {
        if (!input.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'tenantId required for super_admin' });
        tenantId = input.tenantId;
      } else {
        if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });
        tenantId = ctx.tenantId;

        // Admin permission check
        const flags = await executeQuerySingle<any>('SELECT admin_can_manage_zoom FROM tenant_features WHERE tenant_id = ?', [tenantId]);
        if (!flags?.admin_can_manage_zoom) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admins are not permitted to manage Zoom credentials for this institution' });
        }
      }

      // 1. Verify credentials by generating a test token
      const authHeader = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64')
      const tokenResponse = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${input.accountId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      if (!tokenResponse.ok) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Failed to authenticate with Zoom. Please check your credentials.' 
        })
      }

      // 2. Encrypt sensitive data
      const encryptedAccountId = encrypt(input.accountId)
      const encryptedClientId = encrypt(input.clientId)
      const encryptedClientSecret = encrypt(input.clientSecret)

      // 3. Upsert into database
      await executeQuery(
        `INSERT INTO zoom_credentials (tenant_id, account_id, client_id, client_secret, status)
         VALUES (?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
         account_id = VALUES(account_id),
         client_id = VALUES(client_id),
         client_secret = VALUES(client_secret),
         status = 'active'`,
        [tenantId, encryptedAccountId, encryptedClientId, encryptedClientSecret]
      )

      return { success: true }
    }),

  // Remove Zoom Credentials
  remove: adminProcedure
    .input(z.object({ tenantId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      let tenantId: string;
      if (ctx.userRole === 'super_admin') {
        if (!input?.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'tenantId required for super_admin' });
        tenantId = input.tenantId;
      } else {
        if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });
        tenantId = ctx.tenantId;

        // Admin permission check
        const flags = await executeQuerySingle<any>('SELECT admin_can_manage_zoom FROM tenant_features WHERE tenant_id = ?', [tenantId]);
        if (!flags?.admin_can_manage_zoom) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admins are not permitted to manage Zoom credentials for this institution' });
        }
      }

      await executeQuery(
        `DELETE FROM zoom_credentials WHERE tenant_id = ?`,
        [tenantId]
      )

      return { success: true }
    })
})
