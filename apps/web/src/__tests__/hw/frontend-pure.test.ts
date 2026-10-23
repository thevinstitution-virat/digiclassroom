// Handwritten Assignments: pure frontend helpers (PNG encoder, transcript spans).

import { inflateSync, gunzipSync } from 'node:zlib'
import { encodeGreyPng, gzipBytes } from '@/components/hw/ink/png-encode'
import { annotate, wordsOf } from '@/components/hw/text-spans'
import { readPngInfo, checkRender } from '@/lib/hw/ink/png'

/** Undo PNG filter 2 (Up) to get the pixels back. */
function decodeUpFiltered(png: Uint8Array, w: number, h: number): Uint8Array {
  // Find the IDAT chunk.
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let o = 8
  let idat: Uint8Array | null = null
  while (o < png.length) {
    const len = view.getUint32(o)
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8))
    if (type === 'IDAT') idat = png.subarray(o + 8, o + 8 + len)
    o += 12 + len
  }
  const raw = inflateSync(idat!)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    expect(raw[y * (w + 1)]).toBe(2)
    for (let x = 0; x < w; x++) {
      const up = y > 0 ? out[(y - 1) * w + x] : 0
      out[y * w + x] = (raw[y * (w + 1) + 1 + x] + up) & 0xff
    }
  }
  return out
}

describe('greyscale PNG encoder', () => {
  const w = 7
  const h = 5
  const grey = new Uint8Array(w * h).map((_, i) => (i * 37) % 256)

  it('writes a true one-channel PNG of the right size', async () => {
    const png = await encodeGreyPng(grey, w, h)
    expect(readPngInfo(png)).toEqual({ width: w, height: h, bitDepth: 8, colourType: 0 })
  })

  it('round-trips the pixels', async () => {
    const png = await encodeGreyPng(grey, w, h)
    expect(Array.from(decodeUpFiltered(png, w, h))).toEqual(Array.from(grey))
  })

  it('passes the server’s render check within the width limit, and fails beyond it', async () => {
    const png = await encodeGreyPng(new Uint8Array(1000 * 2).fill(255), 1000, 2)
    expect(checkRender(png, 1000).ok).toBe(true)
    expect(checkRender(png, 999).ok).toBe(false)
  })

  it('compresses a white page to almost nothing', async () => {
    const png = await encodeGreyPng(new Uint8Array(1000 * 400).fill(255), 1000, 400)
    expect(png.length).toBeLessThan(5000)
  })

  it('gzips so the server can gunzip it', async () => {
    const text = JSON.stringify({ v: 1, hello: 'नमस्ते' })
    expect(gunzipSync(await gzipBytes(new TextEncoder().encode(text))).toString('utf8')).toBe(text)
  })
})

describe('transcript spans', () => {
  it('finds word offsets that slice back to the word', () => {
    const text = 'पेड़  हमें\nऑक्सीजन देते हैं'
    for (const w of wordsOf(text)) expect(text.slice(w.start, w.end)).toBe(w.text)
    expect(wordsOf(text).map((w) => w.text)).toEqual(['पेड़', 'हमें', 'ऑक्सीजन', 'देते', 'हैं'])
  })

  it('marks unclear words, flags and quotes without losing text', () => {
    const text = 'plants make [?] from sun'
    const spans = annotate(text, [{ start: 0, end: 6 }], ['make'])
    expect(spans.map((s) => s.text).join('')).toBe(text)
    expect(spans.find((s) => s.text === 'plants')?.flag).toBe(true)
    expect(spans.find((s) => s.text === 'make')?.quote).toBe(true)
    expect(spans.find((s) => s.text === '[?]')?.unclear).toBe(true)
  })

  it('ignores a quote that is not in the text', () => {
    const spans = annotate('abc', [], ['zzz'])
    expect(spans.every((s) => !s.quote)).toBe(true)
  })
})
