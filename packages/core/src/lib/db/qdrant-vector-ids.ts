// src/lib/db/qdrant-vector-ids.ts
// Batch 2b — bridge between Qdrant points and the `materials` row they were ingested from.
//
// Why this exists:
//   Qdrant has no foreign keys, so when a material is deleted we have no automatic way to
//   purge its vectors. The qdrant_vector_ids table (created in Phase 2a) records, per
//   indexed chunk, the (material_id → point_id, collection, chunk_index) link. A material
//   delete handler reads this bridge, deletes the points from Qdrant, then lets the
//   ON DELETE CASCADE on material_id clean the bridge rows.
//
// Tenancy note: org-private materials are tagged with organization_id in their Qdrant
// payload (see enhanced-rag-pipeline.ts). NCERT base content is ingested untagged/global
// and is not linked to a material, so it has no bridge rows.

import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface QdrantVectorIdRow {
  materialId: string;
  pointId: string | number;
  collection: string;
  chunkIndex: number;
}

/**
 * Record the Qdrant point ids produced when a material's chunks are indexed.
 * Idempotent on (collection, point_id) — re-indexing the same point updates its link.
 * Returns the number of affected rows. Never throws on a unique/duplicate clash.
 */
export async function recordQdrantVectorIds(rows: QdrantVectorIdRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders = rows.map((r) => {
    values.push(r.materialId, String(r.pointId), r.collection, r.chunkIndex);
    return '(gen_random_uuid()::text, ?, ?, ?, ?, NOW())';
  });

  const sql = `
    INSERT INTO qdrant_vector_ids (id, material_id, point_id, collection, chunk_index, created_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (collection, point_id) DO UPDATE SET
      material_id = excluded.material_id,
      chunk_index = excluded.chunk_index
  `;

  const { affectedRows } = await executeUpdate(sql, values);
  return affectedRows;
}

interface PointRow {
  point_id: string;
  collection: string;
}

/** Read all Qdrant points linked to a material, grouped per collection. */
export async function getMaterialVectorPoints(materialId: string): Promise<Map<string, string[]>> {
  const rows = await executeQuery<PointRow>(
    `SELECT point_id, collection FROM qdrant_vector_ids WHERE material_id = ?`,
    [materialId],
  );

  const byCollection = new Map<string, string[]>();
  for (const r of rows) {
    const list = byCollection.get(r.collection) ?? [];
    list.push(r.point_id);
    byCollection.set(r.collection, list);
  }
  return byCollection;
}

/**
 * Delete a material's vectors from Qdrant using the bridge, then drop the bridge rows.
 *
 * Call this BEFORE deleting the material row: the FK CASCADE would otherwise remove the
 * bridge rows first, and we'd lose the point ids needed to clean Qdrant. Safe to call even
 * if the material has no indexed vectors (returns { pointsDeleted: 0 }).
 */
export async function deleteMaterialVectors(materialId: string): Promise<{ pointsDeleted: number }> {
  const byCollection = await getMaterialVectorPoints(materialId);
  if (byCollection.size === 0) return { pointsDeleted: 0 };

  const client = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
        // @ts-ignore
    checkCompatibility: false,
  });

  let pointsDeleted = 0;
  for (const [collection, pointIds] of byCollection) {
    if (pointIds.length === 0) continue;
    // Qdrant point ids are unsigned ints or UUIDs — send numeric-looking ids back as numbers.
    const points = pointIds.map((id) => (/^\d+$/.test(id) ? Number(id) : id));
    await client.delete(collection, { wait: true, points });
    pointsDeleted += points.length;
  }

  // Explicitly drop bridge rows. This covers the reconciliation case (purge vectors without
  // deleting the material); the ON DELETE CASCADE covers the material-delete case.
  await executeUpdate(`DELETE FROM qdrant_vector_ids WHERE material_id = ?`, [materialId]);
  return { pointsDeleted };
}
