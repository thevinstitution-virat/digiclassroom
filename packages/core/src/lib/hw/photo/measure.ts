// Measures a photographed answer page in the browser, before it is uploaded: how bright it is, how much of it is blown out by glare, and how
// sharp it is. Pure arithmetic on pixels, so it is tested without a browser; the screen draws the photo to a small canvas and passes the pixels.
// Shared by exam booklets and photo answers to homework and InkBuddy.
//
// The numbers feed photo/rules.pageVerdict. Its thresholds are PROVISIONAL until they are calibrated on real photographs of real answer pages; until
// then a learner may override the soft problems (blur, light, glare), and the override is recorded with the page.

export interface Pixels { data: Uint8ClampedArray | Uint8Array; width: number; height: number }
export interface Measured { brightness: number; glare: number; sharpness: number }

/** The variance of the Laplacian at which a page counts as fully sharp, on a picture about 800 pixels on its long side. Provisional. */
export const SHARPNESS_REFERENCE = 400;
/** Luminance at or above this is treated as blown out. */
export const GLARE_LUMA = 250;

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export function measurePage(px: Pixels): Measured {
  const { data, width: w, height: h } = px;
  const n = w * h;
  if (n === 0) return { brightness: 0, glare: 0, sharpness: 0 };
  const y = new Float32Array(n);
  let sum = 0;
  let blown = 0;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = luma(data[j]!, data[j + 1]!, data[j + 2]!);
    y[i] = v;
    sum += v;
    if (v >= GLARE_LUMA) blown++;
  }
  // 4-neighbour Laplacian over the interior; its variance is the classic focus measure
  let lsum = 0;
  let lsq = 0;
  let m = 0;
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c;
      const l = y[i - w]! + y[i + w]! + y[i - 1]! + y[i + 1]! - 4 * y[i]!;
      lsum += l;
      lsq += l * l;
      m++;
    }
  }
  const variance = m ? lsq / m - (lsum / m) ** 2 : 0;
  return {
    brightness: sum / n / 255,
    glare: blown / n,
    sharpness: Math.min(1, variance / SHARPNESS_REFERENCE),
  };
}

/** The size to draw a photo at for measuring: about 800 pixels on the long side, never larger than the photo. */
export function measureSize(width: number, height: number, longSide = 800): { width: number; height: number } {
  const k = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
