/**
 * Resolves a book's stable relational identity from what ingestion already knows
 * (title + organization). Introduced alongside the `books` table (see db/schema.ts)
 * to replace the old "book is just a distinct payload value in Qdrant" model —
 * ingestion should call this going forward instead of treating book identity as
 * ephemeral, so a re-ingestion of the same title lands on the same row rather than
 * silently fragmenting into duplicates the way pure Qdrant grouping always risked.
 *
 * Matches on (legacyBookTitle, organizationId) — the same key
 * scripts/backfill-books-from-qdrant.ts backfills existing rows under — so a title
 * already backfilled from Qdrant resolves to that row rather than creating a
 * second one.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { books } from '@/db/schema';

export interface ResolvedBook {
  id: string;
  title: string;
  organizationId: string | null;
  taxonomyNodeIds: string[];
}

/**
 * Find or create the `books` row for a title + organization pair.
 *
 * `organizationId` follows the same null-means-global convention as the Qdrant
 * payload's `organization_id` field: omit/null for platform NCERT base content,
 * a real org id for tenant-private uploads.
 */
export async function resolveOrCreateBook(
  title: string,
  organizationId: string | null = null,
): Promise<ResolvedBook> {
  const whereOrg = organizationId === null ? isNull(books.organizationId) : eq(books.organizationId, organizationId);

  const existing = await db.query.books.findFirst({
    where: and(eq(books.legacyBookTitle, title), whereOrg),
  });
  if (existing) {
    return {
      id: existing.id,
      title: existing.title,
      organizationId: existing.organizationId,
      taxonomyNodeIds: existing.taxonomyNodeIds,
    };
  }

  const [created] = await db
    .insert(books)
    .values({ title, legacyBookTitle: title, organizationId })
    // A race with another ingestion job resolving the same title lands here instead
    // of erroring — whichever wrote first wins, the loser just reads its row back.
    .onConflictDoUpdate({
      target: [books.legacyBookTitle, books.organizationId],
      set: { updatedAt: new Date() },
    })
    .returning();

  return {
    id: created.id,
    title: created.title,
    organizationId: created.organizationId,
    taxonomyNodeIds: created.taxonomyNodeIds,
  };
}

/** Current taxonomy tag ids for a book — what ingestion should mirror into each
 *  chunk's Qdrant payload (see enhanced-rag-pipeline.ts). */
export async function getBookTaxonomyNodeIds(bookId: string): Promise<string[]> {
  const row = await db.query.books.findFirst({
    where: eq(books.id, bookId),
    columns: { taxonomyNodeIds: true },
  });
  return row?.taxonomyNodeIds ?? [];
}
