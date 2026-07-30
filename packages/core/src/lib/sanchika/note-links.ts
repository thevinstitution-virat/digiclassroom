/**
 * Sanchika wiki-link indexing (Phase 2 — knowledge graph).
 *
 * Notes can reference each other with [[Wiki Links]]. The editor stores them as
 * <a data-wikilink data-target data-label> anchors, but we also parse raw
 * [[Title]] text (e.g. from AI-imported content). On every save we re-extract a
 * note's outgoing links and store them in `note_links` so backlinks and the
 * graph view can be queried cheaply.
 */

import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { randomUUID } from 'crypto';

export interface ExtractedLink {
  label: string;
  target: string | null; // resolved note id, or null if unresolved
}

/** Extract wiki-links from note HTML/text. Dedupes by target id (or label). */
export function extractWikiLinks(content: string): ExtractedLink[] {
  if (!content) return [];
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  // 1) Rendered wiki-link anchors: <a ... data-wikilink ... data-target data-label ...>
  const anchorRe = /<a\b[^>]*\bdata-wikilink\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(content)) !== null) {
    const tag = m[0];
    const label = (tag.match(/data-label="([^"]*)"/i)?.[1] || '').trim();
    const target = ((tag.match(/data-target="([^"]*)"/i)?.[1] || '').trim()) || null;
    if (!label && !target) continue;
    const key = (target || label.toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label: label || '', target });
  }

  // 2) Raw [[Title]] text not wrapped in an anchor
  const rawRe = /\[\[([^[\]]+)\]\]/g;
  while ((m = rawRe.exec(content)) !== null) {
    const label = m[1].trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label, target: null });
  }

  return links;
}

/**
 * Replace a note's outgoing links in note_links. Resolves unresolved links to
 * note ids by (case-insensitive) title within the same user. Safe to call on
 * every save; failures should be caught by the caller so they don't block save.
 */
export async function syncNoteLinks(userId: string, sourceNoteId: string, content: string): Promise<void> {
  const links = extractWikiLinks(content || '');

  // Resolve targets by title for links lacking an explicit id.
  for (const link of links) {
    if (!link.target && link.label) {
      const rows = await executeQuery<{ id: string }>(
        'SELECT id FROM user_notes WHERE user_id = ? AND LOWER(title) = LOWER(?) AND is_archived = FALSE LIMIT 1',
        [userId, link.label]
      );
      if (rows && rows.length) link.target = rows[0].id;
    }
  }

  // Replace this note's outgoing links atomically-ish (delete then insert).
  await executeUpdate('DELETE FROM note_links WHERE source_note_id = ?', [sourceNoteId]);

  for (const link of links) {
    // Skip self-links so the graph has no self-loops.
    if (link.target && link.target === sourceNoteId) continue;
    await executeUpdate(
      `INSERT INTO note_links (id, user_id, source_note_id, target_note_id, link_text, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [randomUUID(), userId, sourceNoteId, link.target, (link.label || '').slice(0, 500)]
    );
  }
}
