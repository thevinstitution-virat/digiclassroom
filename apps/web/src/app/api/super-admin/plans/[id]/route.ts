// src/app/api/super-admin/plans/[id]/route.ts — update / delete a plan (super_admin).

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { subscriptionPlans as P } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { toDb } from '../route'

function idFrom(req: NextRequest) {
  return req.nextUrl.pathname.split('/').filter(Boolean).pop()
}

export async function PUT(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  const id = idFrom(req)
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  try {
    const body = await req.json()
    const values = toDb(body)
    const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined))
    await db.update(P).set(clean).where(eq(P.id, id))
    return NextResponse.json({ success: true, id })
  } catch (e) {
    console.error('[super-admin/plans/[id] PUT]', e)
    return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  const id = idFrom(req)
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  try {
    await db.delete(P).where(eq(P.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[super-admin/plans/[id] DELETE]', e)
    return NextResponse.json({ success: false, error: 'Failed to delete plan' }, { status: 500 })
  }
}
