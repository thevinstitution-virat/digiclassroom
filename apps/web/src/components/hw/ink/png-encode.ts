// A minimal PNG encoder for 8-bit greyscale images, so the render sent to the reader is a
// true one-channel PNG (canvas.toBlob always writes RGBA, about 4x the pixels to compress).
// Uses the browser's CompressionStream('deflate'), which produces exactly the zlib stream
// PNG's IDAT chunk needs.

let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** `grey` is width*height bytes, 0 = black, 255 = white. */
export async function encodeGreyPng(grey: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  // Each scanline starts with a filter byte. Filter 2 (Up) suits ink on white: most rows
  // repeat the row above, so the deltas are mostly zero and compress well.
  const raw = new Uint8Array((width + 1) * height)
  for (let y = 0; y < height; y++) {
    const o = y * (width + 1)
    raw[o] = 2
    for (let x = 0; x < width; x++) {
      const v = grey[y * width + x]
      const up = y > 0 ? grey[(y - 1) * width + x] : 0
      raw[o + 1 + x] = (v - up) & 0xff
    }
  }
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // colour type: greyscale
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
