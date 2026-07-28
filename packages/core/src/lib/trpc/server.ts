import { auth } from '@/auth';
import { headers } from 'next/headers';
import { initTRPC, TRPCError } from '@trpc/server'
import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { ZodError } from 'zod'
import superjson from 'superjson'
import type { UserRole } from '@/lib/validations'

// Create context for tRPC
export const createTRPCContext = async (opts: FetchCreateContextFnOptions | { req: Request; resHeaders: Headers }) => {
  const req = opts.req;

  // Get authentication info from Better Auth
  const authResult = await auth.api.getSession({ headers: req.headers })

  // Better Auth returns { user, session } — map to our context shape
  const userId = authResult?.user?.id ?? null
  const userRole = ((authResult?.user as any)?.role ?? 'student') as UserRole
  // Use organization memberships for tenantId if available, else fallback to 'default'
  const tenantId = (authResult?.user as any)?.tenantId as string ?? 'default'

  return {
    req,
    userId,
    userRole,
    tenantId,
    sessionClaims: authResult?.user ? { metadata: { role: userRole, tenantId } } : null,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

// Base router and procedure
export const createTRPCRouter = t.router
export const baseProcedure = t.procedure

// Authentication middleware
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userRole: ctx.userRole!,
      tenantId: ctx.tenantId!,
    },
  })
})

// Role-based middleware
const enforceUserHasRole = (allowedRoles: UserRole[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.userId || !ctx.userRole) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    if (!allowedRoles.includes(ctx.userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      })
    }

    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
        userRole: ctx.userRole,
        tenantId: ctx.tenantId!,
      },
    })
  })

// Tenant isolation middleware
const enforceTenantIsolation = t.middleware(({ ctx, next }) => {
  // In single-tenant or development mode, use 'default' as fallback
  const tenantId = ctx.tenantId || 'default'

  return next({
    ctx: {
      ...ctx,
      tenantId,
    },
  })
})

// Public procedure (no authentication required)
export const publicProcedure = baseProcedure

// Protected procedure (authentication required)
export const protectedProcedure = baseProcedure
  .use(enforceUserIsAuthed)
  .use(enforceTenantIsolation)

// Super Admin-only procedure
export const superAdminProcedure = baseProcedure
  .use(enforceUserHasRole(['super_admin']))

// Admin+ procedure
export const adminProcedure = baseProcedure
  .use(enforceUserHasRole(['admin', 'super_admin']))
  .use(enforceTenantIsolation)

// Teacher+ procedure (admin and teacher)
export const teacherProcedure = baseProcedure
  .use(enforceUserHasRole(['admin', 'super_admin', 'teacher']))
  .use(enforceTenantIsolation)

// Student+ procedure (admin, teacher, student)
export const studentProcedure = baseProcedure
  .use(enforceUserHasRole(['admin', 'super_admin', 'teacher', 'student']))
  .use(enforceTenantIsolation)

// Parent+ procedure (admin, teacher, parent)
export const parentProcedure = baseProcedure
  .use(enforceUserHasRole(['admin', 'super_admin', 'teacher', 'parent']))
  .use(enforceTenantIsolation)

// Utility function to check if user can access specific class
export const enforceClassAccess = (classId: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    // TODO: Implement class access check based on user role and class membership
    // For now, we'll allow access if user is in the same tenant
    // In production, you'd query the database to verify class access

    return next({
      ctx: {
        ...ctx,
        classId,
      },
    })
  })

// Rate limiting middleware (basic implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export const rateLimit = (maxRequests: number, windowMs: number) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.userId) {
      return next() // Skip rate limiting for unauthenticated users
    }

    const key = `${ctx.userId}-${Date.now() - (Date.now() % windowMs)}`
    const current = rateLimitMap.get(key) || { count: 0, resetTime: Date.now() + windowMs }

    if (current.count >= maxRequests) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      })
    }

    current.count++
    rateLimitMap.set(key, current)

    // Clean up old entries
    if (Math.random() < 0.01) { // 1% chance to clean up
      const now = Date.now()
      for (const [k, v] of Array.from(rateLimitMap.entries())) {
        if (v.resetTime < now) {
          rateLimitMap.delete(k)
        }
      }
    }

    return next()
  })

// Logging middleware
export const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start

  console.log(`${type} ${path} - ${durationMs}ms`)

  return result
})

// Error handling utilities
export const handleTRPCError = (error: unknown, context?: string) => {
  console.error(`tRPC Error${context ? ` in ${context}` : ''}:`, error)

  if (error instanceof TRPCError) {
    throw error
  }

  if (error instanceof ZodError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Validation error',
      cause: error,
    })
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  })
}
