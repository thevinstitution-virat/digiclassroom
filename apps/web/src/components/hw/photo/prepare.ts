// Getting a photo of handwriting ready to upload, in the browser: turned the right way up, measured for light, glare and focus
// (lib/hw/photo/measure.ts) on a small copy, and shrunk to a sensible size as JPEG (greyscale when asked). Re-drawing the picture drops its
// EXIF data, the phone's location included. Shared by exam booklet pages and photo answers.
// The server checks the bytes again (lib/hw/photo/rules.ts); nothing here is trusted for anything but the learner's own convenience.

import { measurePage, measureSize } from '@/lib/hw/photo/measure'
import { pageVerdict, type PageVerdict } from '@/lib/hw/photo/rules'

export type PhotoFacts = { sharpness: number; brightness: number; glare: number }
export interface PreparedPhoto { blob: Blob; facts: PhotoFacts; verdict: PageVerdict }

/** Throws when the file cannot be opened as a picture. */
export async function preparePhoto(file: Blob, uploadLongSide: number, opts: { grey?: boolean } = {}): Promise<PreparedPhoto> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const m = measureSize(bmp.width, bmp.height)
    const small = new OffscreenCanvas(m.width, m.height)
    const sctx = small.getContext('2d')!
    sctx.drawImage(bmp, 0, 0, m.width, m.height)
    const facts = measurePage(sctx.getImageData(0, 0, m.width, m.height))
    const u = measureSize(bmp.width, bmp.height, uploadLongSide)
    const big = new OffscreenCanvas(u.width, u.height)
    const bctx = big.getContext('2d')!
    bctx.drawImage(bmp, 0, 0, u.width, u.height)
    if (opts.grey) {
      // handwriting needs no colour; a grey picture is smaller to send and to store
      const img = bctx.getImageData(0, 0, u.width, u.height)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) { const y = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!; d[i] = d[i + 1] = d[i + 2] = y }
      bctx.putImageData(img, 0, 0)
    }
    const blob = await big.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    return { blob, facts, verdict: pageVerdict({ widthPx: u.width, heightPx: u.height, bytes: blob.size, ...facts }) }
  } finally {
    bmp.close()
  }
}
