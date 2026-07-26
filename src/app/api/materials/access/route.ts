// src/app/api/materials/access/route.ts
// Phase 2b: Previously had NO org scoping at all — used raw getSession with no orgId filter.
// Double-lock applied:
//   Lock 1: withOrgContext({ requireOrg: true })
//   Lock 2: ALL reads/writes include organizationId = orgId
//
// This route tracks which users have accessed which materials and returns access history.
// A user in Org B must never be able to record or read access for Org A's materials.

import { NextRequest, NextResponse } from 'next/server';
import { withOrgContext } from '@/lib/auth/with-org-context';
import type { OrgContext } from '@/lib/auth/get-org-context';
import { db } from '@/db';
import { materials, userMaterialAccess } from '@/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';

// ── POST /api/materials/access ────────────────────────────────────────────────
// Record that the current user accessed a material.
// Validates the material belongs to the caller's org before recording.

export const POST = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    const { userId, orgId } = orgContext;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { materialId } = body as { materialId?: string };

    if (!materialId || typeof materialId !== 'string') {
      return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
    }

    try {
      // ── Lock 2a: verify the material belongs to the caller's org ──────────
      // This prevents a user from recording access to another org's material
      // by guessing a UUID and calling this endpoint directly.
      const [material] = await db
        .select({ id: materials.id, title: materials.title })
        .from(materials)
        .where(
          and(
            eq(materials.id, materialId),
            eq(materials.organizationId, orgId),   // ← org scope check
          ),
        )
        .limit(1);

      if (!material) {
        // Return 404 not 403 — don't confirm the material exists in another org
        return NextResponse.json(
          { error: 'Material not found' },
          { status: 404 },
        );
      }

      // ── Lock 2b: record access with orgId ─────────────────────────────────
      // Upsert pattern: update accessedAt if already accessed, insert if first time.
      // This prevents duplicate rows from rapid re-access.
      await db
        .insert(userMaterialAccess)
        .values({
          id:             crypto.randomUUID(),
          userId,
          materialId,
          organizationId: orgId,       // ← always the caller's org
          accessedAt:     new Date(),
          accessCount:    1,
        })
        .onDuplicateKeyUpdate({
          set: {
            accessedAt:  new Date(),
            accessCount: sql`access_count + 1`,
          },
        });

      return NextResponse.json({ success: true, materialId });

    } catch (err) {
      console.error('[materials/access POST]', err);
      return NextResponse.json(
        { error: 'Failed to record access' },
        { status: 500 },
      );
    }
  },
  { requireOrg: true },
);

// ── GET /api/materials/access ─────────────────────────────────────────────────
// Return the current user's material access history, scoped to their org.
// org_admin / owner can optionally pass ?userId= to see another user's history.

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    const { userId, orgId, orgRole, isPlatformBypass } = orgContext;
    const { searchParams } = req.nextUrl;

    // org_admin and above can query any user in their org
    const canQueryOthers =
      isPlatformBypass ||
      orgRole === 'owner' ||
      orgRole === 'org_admin';

    const targetUserId = canQueryOthers
      ? (searchParams.get('userId') ?? userId)
      : userId;   // non-admins can only see their own history

    const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
    const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const offset = (page - 1) * limit;

    try {
      // ── Lock 2: scope access history to the caller's org ──────────────────
      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            accessId:    userMaterialAccess.id,
            materialId:  userMaterialAccess.materialId,
            accessedAt:  userMaterialAccess.accessedAt,
            accessCount: userMaterialAccess.accessCount,
            // Join material details for convenience
            title:       materials.title,
            subject:     materials.subject,
            grade:       materials.grade,
            type:        materials.type,
          })
          .from(userMaterialAccess)
          .innerJoin(
            materials,
            and(
              eq(userMaterialAccess.materialId, materials.id),
              eq(materials.organizationId, orgId),   // ← org scope on the join
            ),
          )
          .where(
            and(
              eq(userMaterialAccess.userId, targetUserId),
              eq(userMaterialAccess.organizationId, orgId),  // ← org scope on access
            ),
          )
          .orderBy(desc(userMaterialAccess.accessedAt))
          .limit(limit)
          .offset(offset),

        db
          .select({ total: sql<number>`count(*)` })
          .from(userMaterialAccess)
          .where(
            and(
              eq(userMaterialAccess.userId, targetUserId),
              eq(userMaterialAccess.organizationId, orgId),
            ),
          ),
      ]);

      return NextResponse.json({
        history: rows,
        pagination: {
          page,
          limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / limit),
        },
      });

    } catch (err) {
      console.error('[materials/access GET]', err);
      return NextResponse.json(
        { error: 'Failed to fetch access history' },
        { status: 500 },
      );
    }
  },
  { requireOrg: true },
);
