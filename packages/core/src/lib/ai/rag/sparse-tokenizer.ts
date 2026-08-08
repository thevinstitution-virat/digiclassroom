/**
 * Shared sparse-vector tokenizer for the trio content collection.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FILE IS A CROSS-REPO CONTRACT. Changing it silently breaks retrieval.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DCP builds the document-side sparse vectors at ingest; PDLMS/Varta builds the
 * query-side sparse vectors at search time, in a different repo. A sparse dot
 * product is only meaningful if BOTH sides map the same word to the same index.
 * If one side lowercases and the other doesn't, or one strips a diacritic the
 * other keeps, nothing errors — recall just quietly degrades, and it presents as
 * "the model gives bad answers" rather than as a tokenizer bug. That is close to
 * undiagnosable after the fact, so the algorithm is pinned here in full and both
 * repos test against `sparse-tokenizer.fixture.json`.
 *
 * ## Algorithm (normalization steps, in this exact order)
 *
 *   1. Unicode NFKC normalization.
 *   2. Lowercase via `toLowerCase()` (locale-independent — NOT `toLocaleLowerCase`,
 *      whose Turkish dotless-i behaviour differs by host locale).
 *   3. Replace every run of characters that is not a Unicode letter, number, or
 *      COMBINING MARK (`/[^\p{L}\p{N}\p{M}]+/gu`) with a single space. Both the
 *      Unicode-awareness and the mark class are load-bearing for this corpus —
 *      see NON_TOKEN_CHAR below.
 *   4. Trim, then split on single spaces.
 *   5. Drop tokens shorter than MIN_TOKEN_LENGTH (2). Single characters carry
 *      almost no retrieval signal and inflate the vector.
 *
 * Deliberately NOT done, because each is a divergence risk across repos and
 * buys little on top of IDF:
 *   - stemming / lemmatization
 *   - stopword removal (Qdrant's `modifier: idf` already discounts common terms)
 *   - transliteration
 *
 * ## Index
 *
 * FNV-1a, 32-bit, over the **UTF-8 bytes** of the normalized token. Specifying
 * the encoding matters: JS strings are UTF-16 internally, so hashing "code
 * units" instead of UTF-8 bytes gives different values for every non-ASCII term
 * — which would look correct in an all-English test and fail on Hindi.
 *
 *   offset basis 0x811c9dc5 (2166136261), prime 0x01000193 (16777619)
 *
 * ## Value
 *
 * Raw term frequency — the count of the token within the text. NOT a BM25 or
 * TF-IDF weight. The collection is configured with `modifier: idf`, so Qdrant
 * applies the IDF component itself; pre-weighting here would apply it twice.
 */

export const MIN_TOKEN_LENGTH = 2;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Letters, numbers, AND combining marks.
 *
 * `\p{M}` is not optional here. Devanagari builds syllables from a base letter
 * plus combining marks — viramas and matras (्, ा, ि, ो …) are category Mn/Mc,
 * NOT `\p{L}`. Without `\p{M}` this class treats them as punctuation, so
 * "प्रकाश" (prakāsh) shatters into "प", "रक", "श" and the minimum-length filter
 * then discards most of the wreckage. Every Hindi term in the corpus would hash
 * to fragments that match nothing, while English kept working perfectly — the
 * exact shape of bug that gets diagnosed as "retrieval is bad in Hindi" months
 * later.
 */
const NON_TOKEN_CHAR = /[^\p{L}\p{N}\p{M}]+/gu;

/**
 * Normalize and split text into sparse-vector tokens. Steps 1-5 above.
 */
export function tokenizeForSparse(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(NON_TOKEN_CHAR, ' ')
    .trim();
  if (!normalized) return [];
  return normalized.split(' ').filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

/**
 * FNV-1a 32-bit over the UTF-8 bytes of `term`, returned as an unsigned int.
 *
 * `Math.imul` keeps the multiply in 32-bit space — a plain `*` overflows into
 * float64 past 2^53 and silently produces different hashes than any other
 * language's FNV-1a.
 */
export function hashTerm(term: string): number {
  const bytes = new TextEncoder().encode(term);
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

/**
 * Build the sparse vector for a chunk (or a query — both sides use this).
 *
 * Duplicate terms are summed into one entry: Qdrant requires unique indices, and
 * a repeated index is exactly the term-frequency signal we want anyway.
 * Entries are sorted by index so the output is byte-stable across runs, which
 * makes the fixture comparison and any future diffing meaningful.
 */
export function buildSparseVector(text: string): SparseVector {
  const counts = new Map<number, number>();
  for (const token of tokenizeForSparse(text)) {
    const index = hashTerm(token);
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  const indices = Array.from(counts.keys()).sort((a, b) => a - b);
  return {
    indices,
    values: indices.map((i) => counts.get(i) as number),
  };
}
