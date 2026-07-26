// src/app/api/super-admin/users/route.ts
// Platform user directory (super_admin only). Rebuilt off the Better Auth `user`
// table via Drizzle (the previous version was a Clerk-era stub that returned an
// empty array). Joins `member`→`organization` so each row shows its institution.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { user, member, organization } from '@/db/schema'
import { and, or, eq, like, asc, desc, sql, inArray } from 'drizzle-orm'
import { sendEmail, emailLayout } from '@/lib/email/send-email'
import { isDesignatedSuperAdmin } from '@/lib/auth/super-admin-guard'

// ── GET — list users with search / role / status filters, sort, pagination ───
export async function GET(request: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const sp = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20')))
  const search = (sp.get('search') || '').trim()
  const role = sp.get('role') || 'all'
  const status = sp.get('status') || 'all'
  const sortBy = sp.get('sortBy') || 'createdAt'
  const sortOrder = sp.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  const offset = (page - 1) * limit

  try {
    const conds = []
    if (search) {
      const s = `%${search}%`
      conds.push(or(like(user.name, s), like(user.email, s), like(user.firstName, s), like(user.lastName, s)))
    }
    if (role !== 'all') conds.push(eq(user.role, role))
    // No `status` column exists — derive from email verification.
    if (status === 'active') conds.push(eq(user.emailVerified, true))
    else if (status === 'pending') conds.push(eq(user.emailVerified, false))
    const where = conds.length ? and(...conds) : undefined

    const sortCol =
      sortBy === 'name' ? user.name :
      sortBy === 'email' ? user.email :
      sortBy === 'role' ? user.role :
      sortBy === 'lastSignInAt' ? user.lastLogin :
      user.createdAt
    const orderBy = sortOrder === 'asc' ? asc(sortCol) : desc(sortCol)

    const [countRow] = await db.select({ c: sql<number>`count(*)` }).from(user).where(where)
    const total = Number(countRow?.c ?? 0)

    const rows = await db.select().from(user).where(where).orderBy(orderBy).limit(limit).offset(offset)

    // Resolve institution (org membership) for the page's users.
    const ids = rows.map((r) => r.id)
    const orgByUser = new Map<string, string>()
    if (ids.length) {
      const mships = await db
        .select({ userId: member.userId, orgName: organization.name })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(inArray(member.userId, ids))
      for (const m of mships) if (!orgByUser.has(m.userId)) orgByUser.set(m.userId, m.orgName)
    }

    const users = rows.map((u) => {
      const first = u.firstName || (u.name?.split(' ')[0] ?? '')
      const last = u.lastName || (u.name?.split(' ').slice(1).join(' ') ?? '')
      return {
        id: u.id,
        firstName: first || null,
        lastName: last || null,
        fullName: u.name || `${first} ${last}`.trim() || u.email.split('@')[0] || 'Unknown',
        email: u.email,
        profileImageUrl: u.image ?? null,
        role: u.role ?? 'student',
        status: u.emailVerified ? 'active' : 'pending',
        createdAt: u.createdAt,
        lastSignInAt: u.lastLogin ?? null,
        emailVerified: !!u.emailVerified,
        phoneNumber: null,
        institution: orgByUser.get(u.id) ?? null,
        metadata: {},
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        users,
        totalCount: total,
        hasNextPage: offset + limit < total,
        hasPreviousPage: page > 1,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[users] list failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ── POST — add a platform user (super_admin) + send a welcome email ──────────
const VALID_ROLES = ['super_admin', 'admin', 'teacher', 'student', 'parent']

export async function POST(request: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const role = String(body.role ?? 'student')
    const name = String(body.name ?? body.firstName ?? '').trim() || email.split('@')[0]

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
    }
    // SECURITY: super_admin can only ever be the configured platform owner.
    if (role === 'super_admin' && !isDesignatedSuperAdmin(email)) {
      return NextResponse.json(
        { success: false, error: 'super_admin is reserved for the platform owner and cannot be assigned' },
        { status: 403 }
      )
    }

    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
    if (existing.length) {
      return NextResponse.json({ success: false, error: 'A user with this email already exists' }, { status: 409 })
    }

    const id = crypto.randomUUID()
    // Admin-provisioned account: mark verified (the super admin vouches for it) so
    // the email-verification gate doesn't block first sign-in. They sign in via the
    // magic link / Google, or set a password through "forgot password".
    await db.insert(user).values({ id, name, email, role, emailVerified: true })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000'
    const emailResult = await sendEmail({
      to: email,
      subject: 'Welcome to DigiClassroom Pro',
      html: emailLayout({
        heading: 'Your DigiClassroom Pro account is ready',
        body: `An account has been created for you as <strong>${role.replace(/_/g, ' ')}</strong>. Click below to sign in — use the “magic link” option or Google with this email address.`,
        ctaLabel: 'Sign in',
        ctaUrl: `${appUrl}/sign-in`,
      }),
    })

    return NextResponse.json({
      success: true,
      message: `User ${email} created`,
      data: { id, email, role, welcomeEmailSent: emailResult.ok },
    })
  } catch (error) {
    console.error('[users] create failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
