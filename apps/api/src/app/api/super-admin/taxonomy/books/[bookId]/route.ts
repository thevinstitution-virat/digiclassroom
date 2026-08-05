/**
 * Shared cross-repo curriculum taxonomy -- tagging a book. Distinct from the
 * genre/subject fields materials already carries; this is the board/class/subject/
 * degree/exam classification used to scope RAG retrieval to a student's institute
 * curriculum (see qdrant-search.ts's taxonomyScopeNodeIds).
 *
 * GET  /api/super-admin/taxonomy/books/[bookId]  -- current tags
 * PUT  /api/super-admin/taxonomy/books/[bookId]  -- replace the full tag set
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requirePlatformStaff } from '@/lib/auth/require-platform-staff';
import { getBookTaxonomyLinks, setBookTaxonomyLinks } from '@/lib/taxonomy/client';
import { db } from '@/db';
import { books } from '@/db/schema';

export async function GET(
  _request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  const guard = await requirePlatformStaff();
  if (!guard.ok) return guard.response;

  const { bookId } = params;
  const book = await db.query.books.findFirst({ where: eq(books.id, bookId) });
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
  }

  // The hub is the source of truth for the denormalized detail (names/slugs/paths);
  // Book.taxonomyNodeIds is just the locally-mirrored id list used for retrieval.
  const links = await getBookTaxonomyLinks(bookId);
  return NextResponse.json({ success: true, data: { bookId, links } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  const guard = await requirePlatformStaff();
  if (!guard.ok) return guard.response;

  const { bookId } = params;
  const book = await db.query.books.findFirst({ where: eq(books.id, bookId) });
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
  }

  const body = (await request.json()) as { links?: Array<{ nodeId: string; isPrimary?: boolean }> };
  if (!body.links || body.links.length === 0) {
    return NextResponse.json({ success: false, error: 'links must be a non-empty array' }, { status: 400 });
  }

  try {
    const resolved = await setBookTaxonomyLinks(bookId, body.links);
    await db
      .update(books)
      .set({ taxonomyNodeIds: resolved.map((l) => l.nodeId), updatedAt: new Date() })
      .where(eq(books.id, bookId));

    return NextResponse.json({ success: true, data: { bookId, links: resolved } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
