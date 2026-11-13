// What an uploaded picture really is, from its own header bytes (never from a file name or a declared type): PNG, JPEG or WebP, and its size
// in pixels. Shared by board-paper figures, exam booklet pages and photo answers.

export interface ImageInfo { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'png' | 'jpg' | 'webp'; width: number; height: number; bytes: number }

const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));

/** What the bytes really are, from their own header (never from a file name), with the size in pixels — no size limits applied. */
export function readImageHeader(bytes: Uint8Array): ImageInfo | { problem: string } {
  const n = bytes.length;
  if (n === 0) return { problem: 'the file is empty' };
  let kind: ImageInfo['mime'] | null = null;
  let width = 0;
  let height = 0;
  if (n >= 24 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && ascii(bytes, 12, 4) === 'IHDR') {
    kind = 'image/png'; width = u32be(bytes, 16); height = u32be(bytes, 20);
  } else if (n >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    kind = 'image/jpeg';
    for (let i = 2; i + 9 < n;) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { height = u16be(bytes, i + 5); width = u16be(bytes, i + 7); break; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + u16be(bytes, i + 2);
    }
  } else if (n >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    kind = 'image/webp';
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8X') { width = 1 + u24le(bytes, 24); height = 1 + u24le(bytes, 27); }
    else if (chunk === 'VP8 ') { width = (bytes[26] | (bytes[27] << 8)) & 0x3fff; height = (bytes[28] | (bytes[29] << 8)) & 0x3fff; }
    else if (chunk === 'VP8L') { const v = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24); width = 1 + (v & 0x3fff); height = 1 + ((v >>> 14) & 0x3fff); }
  }
  if (!kind) return { problem: 'this is not a PNG, JPEG or WebP picture' };
  if (!width || !height) return { problem: 'the size of the picture could not be read' };
  return { mime: kind, ext: kind === 'image/png' ? 'png' : kind === 'image/jpeg' ? 'jpg' : 'webp', width, height, bytes: n };
}

/** The picture type a stored key was written with, from its extension (keys are built by storage/keys.ts). */
export function mimeOfKey(key: string): ImageInfo['mime'] {
  const ext = key.split('.').pop()?.toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
}
