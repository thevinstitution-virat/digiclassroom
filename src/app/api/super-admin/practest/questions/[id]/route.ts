// src/app/api/super-admin/practest/questions/[id]/route.ts
// Super-admin: update (PATCH, partial — also used for approve/reject) + delete a question.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestQuestionBank as Q } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { toDb } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  try {
    const body = await req.json()
    const mapped = toDb(body) as Record<string, unknown>
    // Partial update: keep only fields the caller actually sent.
    const set = Object.fromEntries(Object.entries(mapped).filter(([, v]) => v !== undefined))
    if (Object.keys(set).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }
    await db.update(Q).set(set).where(eq(Q.id, params.id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[practest/questions PATCH]', e)
    return NextResponse.json({ success: false, error: 'Failed to update question' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  try {
    await db.delete(Q).where(eq(Q.id, params.id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[practest/questions DELETE]', e)
    return NextResponse.json({ success: false, error: 'Failed to delete question' }, { status: 500 })
  }
}
