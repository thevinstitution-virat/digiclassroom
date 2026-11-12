// Cutting a booklet page into the two overlapping halves halves.ts describes. `sharp` is loaded on demand: it reaches the api through
// @xenova/transformers and next, not as a dependency of its own, so if it is ever missing the page is read whole, as before, and the log says why.

import { halfRects } from './halves';

export type HalfCropper = (image: Uint8Array) => Promise<[Uint8Array, Uint8Array] | null>;

let warned = false;

/** A cropper backed by sharp, or null when sharp cannot be loaded (pages are then read whole). */
export async function sharpHalfCropper(): Promise<HalfCropper | null> {
  let sharp: typeof import('sharp');
  try {
    const mod = await import('sharp');
    sharp = ((mod as unknown as { default?: typeof import('sharp') }).default ?? mod) as typeof import('sharp');
  } catch (e) {
    if (!warned) { warned = true; console.warn(`[hw-exams] sharp is not available, booklet pages are read whole: ${(e as Error)?.message ?? e}`); }
    return null;
  }
  return async (image) => {
    const meta = await sharp(image).metadata();
    // EXIF orientations 5-8 turn the picture a quarter: the page's height is the stored width
    const turned = (meta.orientation ?? 1) >= 5;
    const rects = halfRects(turned ? meta.height ?? 0 : meta.width ?? 0, turned ? meta.width ?? 0 : meta.height ?? 0);
    if (!rects) return null;
    // rotate() first, so the cut is made on the page as the learner sees it
    const [a, b] = await Promise.all(rects.map((r) => sharp(image).rotate().extract(r).jpeg({ quality: 88 }).toBuffer()));
    return [new Uint8Array(a!), new Uint8Array(b!)];
  };
}

/** sharp, or null when it cannot be loaded. */
export async function loadSharp(): Promise<typeof import('sharp') | null> {
  try {
    const mod = await import('sharp');
    return ((mod as unknown as { default?: typeof import('sharp') }).default ?? mod) as typeof import('sharp');
  } catch {
    return null;
  }
}

/** A photo as RGB pixels, turned upright by its EXIF orientation (sheet-vision.ts works on these). */
export async function decodeRaster(sharp: typeof import('sharp'), image: Uint8Array): Promise<import('./sheet-vision').Raster> {
  const { data, info } = await sharp(image).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels === 1 ? 1 : 3, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/** A raster as a JPEG, for sending to the reader. */
export async function encodeJpeg(sharp: typeof import('sharp'), r: import('./sheet-vision').Raster, quality = 88): Promise<Uint8Array> {
  const buf = await sharp(Buffer.from(r.data.buffer, r.data.byteOffset, r.data.length), { raw: { width: r.width, height: r.height, channels: r.channels } }).jpeg({ quality }).toBuffer();
  return new Uint8Array(buf);
}
