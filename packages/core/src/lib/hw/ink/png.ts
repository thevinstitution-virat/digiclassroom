// Server-side check of an uploaded render: it must really be a PNG, within the size the
// reader is configured for. Reads only the signature and the IHDR chunk; no image library.

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  /** 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA */
  colourType: number;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  if (bytes.length < 33) return null;
  for (let i = 0; i < SIGNATURE.length; i++) if (bytes[i] !== SIGNATURE[i]) return null;
  // First chunk must be IHDR (length 13).
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13) return null;
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (type !== 'IHDR') return null;
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: bytes[24],
    colourType: bytes[25],
  };
}

export function checkRender(bytes: Uint8Array, maxWidth: number): { ok: true; info: PngInfo } | { ok: false; problem: string } {
  const info = readPngInfo(bytes);
  if (!info) return { ok: false, problem: 'render is not a PNG' };
  if (info.width < 1 || info.height < 1) return { ok: false, problem: 'render is empty' };
  if (info.width > maxWidth) return { ok: false, problem: `render is ${info.width}px wide; the maximum is ${maxWidth}px` };
  if (info.height > maxWidth * 8) return { ok: false, problem: 'render is too tall' };
  return { ok: true, info };
}
