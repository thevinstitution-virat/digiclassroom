// src/app/api/super-admin/qdrant/clear/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getOrgContextOrNull } from '@/lib/auth/get-org-context';
import { hasPermission } from '@/auth/permissions';
import { db } from '@/db';
import { adminActivityLog } from '@/db/schema';

const COLLECTION = process.env.QDRANT_COLLECTION_NAME ?? 'ncert-books-enhanced';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const ctx = await getOrgContextOrNull();

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.globalRole, 'manage:platform')) {
    return NextResponse.json(
      { error: 'Forbidden: manage:platform permission required (super_admin only)' },
      { status: 403 },
    );
  }

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

  try {
        // @ts-ignore
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
    console.error('[qdrant/clear] Failed to write audit log:', auditErr);
    return NextResponse.json(
      { error: 'Failed to write audit log. Clear operation aborted.' },
      { status: 500 },
    );
  }

  try {
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL ?? 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    await qdrant.delete(COLLECTION, {
      filter: { must: [{ is_empty: { key: '__non_existent__' } }] },
    });

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

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
