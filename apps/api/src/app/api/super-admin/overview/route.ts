// src/app/api/super-admin/overview/route.ts — platform stats for the super-admin dashboard.
import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { organization, user } from '@/db/schema'
import { sql } from 'drizzle-orm'

export async function GET() {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const [orgRow] = await db.select({ c: sql<number>`count(*)` }).from(organization)
  const [userRow] = await db.select({ c: sql<number>`count(*)` }).from(user)
  const roleRows = await db
    .select({ role: user.role, c: sql<number>`count(*)` })
    .from(user)
    .groupBy(user.role)

  const byRole: Record<string, number> = {}
  for (const r of roleRows) byRole[(r.role as string) ?? 'unknown'] = Number(r.c)

  return NextResponse.json({
    institutions: Number(orgRow?.c ?? 0),
    users: Number(userRow?.c ?? 0),
    students: byRole['student'] ?? 0,
    teachers: byRole['teacher'] ?? 0,
    institutionAdmins: byRole['admin'] ?? 0,
    parents: byRole['parent'] ?? 0,
  })
}
