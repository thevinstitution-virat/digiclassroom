// Photo answers (Phase 5P, owner's go-ahead 13 Nov 2026): the pure parts. The upload, reading and teacher view run against a database in
// integration.test.ts ("photo answer").

import { answerFileKey, answerImageKey, assertHwKey, keyVersion } from '@/lib/hw/storage/keys'
import { mimeOfKey, readImageHeader } from '@/lib/hw/photo/image'
import { PHOTO_LIMITS, pageVerdict } from '@/lib/hw/photo/rules'
import { PAGE_LIMITS } from '@/lib/hw/exams/rules'
import { readImageHeader as figuresHeader } from '@/lib/hw/bank/figures'
import { measurePage as examMeasure } from '@/lib/hw/exams/page-measure'
import { measurePage } from '@/lib/hw/photo/measure'
import { PRACTICE_ORG_ID, answerModesOf } from '@/lib/hw/practice/rules'

/** The smallest bytes readImageHeader takes for a JPEG of this size (a start marker and one frame header). */
function fakeJpeg(width: number, height: number, pad = 64): Uint8Array {
  const b = new Uint8Array(20 + pad)
  b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff])
  return b
}

const ref = { orgId: 'org1', assignmentId: 'a1', submissionId: 's1', questionId: 'q1' }

describe('photo answers: keys and pictures', () => {
  it('a photo key keeps its real type and a version, under the feature prefix', () => {
    const k = answerFileKey(ref, 'photo', 3, 'jpg')
    expect(k).toBe('hw-assignments/org1/a1/s1/q1/photo.v3.jpg')
    expect(assertHwKey(k)).toBe(k)
    expect(keyVersion(k)).toBe(3)
    expect(answerFileKey(ref, 'photo', 1)).toMatch(/photo\.v1\.webp$/) // no type given: the old default
    expect(answerFileKey(ref, 'render', 1, 'jpg')).toMatch(/render\.v1\.png$/) // only a photo takes a type
  })

  it('the picture that is read follows the mode handed in with, when both exist', () => {
    const both = { renderKey: 'hw-assignments/o/a/s/q/render.v2.png', imageKey: 'hw-assignments/o/a/s/q/photo.v1.jpg' }
    expect(answerImageKey({ mode: 'photo', ...both })).toBe(both.imageKey)
    expect(answerImageKey({ mode: 'ink', ...both })).toBe(both.renderKey)
    expect(answerImageKey({ mode: 'photo', renderKey: both.renderKey, imageKey: null })).toBeNull() // never the old writing for a photo answer
    expect(answerImageKey({ mode: 'ink', renderKey: null, imageKey: both.imageKey })).toBe(both.imageKey) // as before
  })

  it('the reader is told the picture type from the key', () => {
    expect(mimeOfKey('x/photo.v1.jpg')).toBe('image/jpeg')
    expect(mimeOfKey('x/photo.v1.webp')).toBe('image/webp')
    expect(mimeOfKey('x/render.v1.png')).toBe('image/png')
  })

  it('what the bytes are, never the name: JPEG size read from the frame header', () => {
    expect(readImageHeader(fakeJpeg(1200, 1600))).toMatchObject({ mime: 'image/jpeg', ext: 'jpg', width: 1200, height: 1600 })
    expect(readImageHeader(new TextEncoder().encode('<svg></svg>'))).toHaveProperty('problem')
  })

  it('a photo must be big enough to read; light and focus problems can be overridden, size cannot', () => {
    const good = { widthPx: 1200, heightPx: 1600, bytes: 300_000, sharpness: 0.6, brightness: 0.6, glare: 0.01 }
    expect(pageVerdict(good)).toEqual({ ok: true })
    expect(pageVerdict({ ...good, widthPx: 1000, heightPx: 750 })).toEqual({ ok: false, why: 'too_small' })
    expect(pageVerdict({ ...good, sharpness: 0.1 })).toEqual({ ok: false, why: 'too_blurred' })
    // 1600 on the long side, as the answer screen sends, passes for portrait, landscape and 16:9
    for (const [w, h] of [[1200, 1600], [1600, 1200], [1600, 900]]) expect(pageVerdict({ ...good, widthPx: w, heightPx: h })).toEqual({ ok: true })
  })

  it('exam booklets keep their limits and checks: the same functions, plus the page count', () => {
    expect(PAGE_LIMITS).toEqual({ ...PHOTO_LIMITS, maxPages: 40 })
    expect(figuresHeader).toBe(readImageHeader)
    expect(examMeasure).toBe(measurePage)
  })
})

describe('photo answers: who may send one', () => {
  it('InkBuddy always takes a photo; a school assignment only when the teacher allowed it', () => {
    expect(answerModesOf({ organizationId: PRACTICE_ORG_ID, allowedModes: ['ink', 'typed'] })).toEqual(['ink', 'typed', 'photo'])
    expect(answerModesOf({ organizationId: PRACTICE_ORG_ID, allowedModes: ['photo'] })).toEqual(['photo'])
    expect(answerModesOf({ organizationId: 'school-1', allowedModes: ['ink', 'typed'] })).toEqual(['ink', 'typed'])
  })
})
