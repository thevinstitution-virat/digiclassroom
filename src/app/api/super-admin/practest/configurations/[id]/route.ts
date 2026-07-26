// src/app/api/super-admin/practest/configurations/[id]/route.ts
// Read / update / delete a single test series. super_admin only.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestTestConfigurations as C } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { toApi, toDb } from '../route'

async function getId(params: unknown): Promise<string> {
  const p = await (params as Promise<{ id: string }>)
  return p.id
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  const id = await getId(ctx.params)
  try {
    const [row] = await db.select().from(C).where(eq(C.id, id)).limit(1)
    if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, configuration: toApi(row) })
  } catch (e) {
    console.error('[practest/configurations/[id] GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load test series' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  const id = await getId(ctx.params)
  try {
    const body = await req.json()
    const values = toDb(body)
    // Drop undefined keys so we only update provided fields.
    const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined))
    await db.update(C).set(clean).where(eq(C.id, id))
    return NextResponse.json({ success: true, id })
  } catch (e) {
    console.error('[practest/configurations/[id] PUT]', e)
    return NextResponse.json({ success: false, error: 'Failed to update test series' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  const id = await getId(ctx.params)
  try {
    await db.delete(C).where(eq(C.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[practest/configurations/[id] DELETE]', e)
    return NextResponse.json({ success: false, error: 'Failed to delete test series' }, { status: 500 })
  }
}
