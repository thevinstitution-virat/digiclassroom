// src/app/api/super-admin/qdrant/clear/route.ts
// Bug I6 fix: /api/super-admin/qdrant/clear had no confirmation gate — one request wiped the
// entire vector DB. Now requires:
//   1. super_admin role only (not just admin — this is a manage:platform operation)
//   2. ?confirm=yes query param
//   3. X-Confirm-Collection header matching the collection name being cleared
//   4. Audit log entry written before the destructive op

import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getOrgContextOrNull } from '@/lib/auth/get-org-context';
import { hasPermission } from '@/auth/permissions';
import { db } from '@/db';
import { adminActivityLog } from '@/db/schema';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
});

const COLLECTION = process.env.QDRANT_COLLECTION_NAME ?? 'ncert-books-enhanced';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth: super_admin only ───────────────────────────────────────────────
  const ctx = await getOrgContextOrNull();

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // manage:platform is super_admin only — admin staff cannot clear the vector DB
  if (!hasPermission(ctx.globalRole, 'manage:platform')) {
    return NextResponse.json(
      { error: 'Forbidden: manage:platform permission required (super_admin only)' },
      { status: 403 },
    );
  }

  // ── 2. Confirmation query param ────────────────────────────────────────────
  const confirmParam = req.nextUrl.searchParams.get('confirm');
  if (confirmParam !== 'yes') {
    return NextResponse.json(
      {
        error: 'Missing confirmation. Add ?confirm=yes to the request.',
        hint: 'Also set X-Confirm-Collection header to the collection name.',
      },
      { status: 400 },
    );
  }

  // ── 3. Collection name header confirmation ─────────────────────────────────
  // Caller must explicitly name the collection they intend to clear.
  const confirmCollection = req.headers.get('x-confirm-collection');
  if (confirmCollection !== COLLECTION) {
    return NextResponse.json(
      {
        error: `Collection name mismatch. Expected X-Confirm-Collection: ${COLLECTION}`,
        received: confirmCollection,
      },
      { status: 400 },
    );
  }

  // ── 4. Write audit log BEFORE the destructive operation ───────────────────
  try {
    await db.insert(adminActivityLog).values({
      id: crypto.randomUUID(),
      adminId: ctx.userId,
      action: 'qdrant_collection_clear',
      target: COLLECTION,
      metadata: JSON.stringify({
        collection: COLLECTION,
        initiatedAt: new Date().toISOString(),
        ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      }),
      createdAt: new Date(),
    });
  } catch (auditErr) {
    // Audit log failure is a hard stop — do NOT proceed without a trace
    console.error('[qdrant/clear] Failed to write audit log:', auditErr);
    return NextResponse.json(
      { error: 'Failed to write audit log. Clear operation aborted.' },
      { status: 500 },
    );
  }

  // ── 5. Perform the collection clear ───────────────────────────────────────
  try {
    // Delete all points but keep the collection schema intact
    await qdrant.delete(COLLECTION, {
      filter: { must: [{ is_empty: { key: '__non_existent__' } }] },
    });

    // Safer alternative: recreate the collection
    // This preserves the vector config while guaranteeing a clean state.
    // Uncomment if the filter approach above doesn't fully clear in your Qdrant version:
    // const collectionInfo = await qdrant.getCollection(COLLECTION);
    // await qdrant.deleteCollection(COLLECTION);
    // await qdrant.createCollection(COLLECTION, {
    //   vectors: collectionInfo.config.params.vectors,
    // });

    console.warn(
      `[qdrant/clear] Collection "${COLLECTION}" cleared by super_admin ${ctx.userId}`,
    );

    return NextResponse.json({
      success: true,
      collection: COLLECTION,
      clearedBy: ctx.userId,
      clearedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[qdrant/clear] Qdrant operation failed:', err);
    return NextResponse.json(
      { error: 'Qdrant clear operation failed', detail: String(err) },
      { status: 500 },
    );
  }
}

// Block all non-DELETE methods explicitly
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
