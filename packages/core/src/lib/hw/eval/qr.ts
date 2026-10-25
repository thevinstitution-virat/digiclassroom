// Minimal QR Code encoder (ISO/IEC 18004): byte mode, error correction level M, versions
// 1–10, automatic mask choice. Enough for item tokens on copy sheets (~30 bytes, version 3),
// with no dependency. Follows the structure of Project Nayuki's reference implementation.

const EC_M: Record<number, { ecPerBlock: number; blocks: [number, number][] }> = {
  // version: EC codewords per block, [[block count, data codewords per block], …]
  1: { ecPerBlock: 10, blocks: [[1, 16]] },
  2: { ecPerBlock: 16, blocks: [[1, 28]] },
  3: { ecPerBlock: 26, blocks: [[1, 44]] },
  4: { ecPerBlock: 18, blocks: [[2, 32]] },
  5: { ecPerBlock: 24, blocks: [[2, 43]] },
  6: { ecPerBlock: 16, blocks: [[4, 27]] },
  7: { ecPerBlock: 18, blocks: [[4, 31]] },
  8: { ecPerBlock: 22, blocks: [[2, 38], [2, 39]] },
  9: { ecPerBlock: 22, blocks: [[3, 36], [2, 37]] },
  10: { ecPerBlock: 26, blocks: [[4, 43], [1, 44]] },
};

const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ── GF(256), polynomial 0x11D ──────────────────────────────────────────────────────────
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

export function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

export function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const f = b ^ (r.shift() as number);
    r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

/** 15-bit format information for level M and a mask (BCH(15,5) + mask 0x5412). */
export function formatBits(mask: number): number {
  const data = (0 << 3) | mask; // level M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(v: number): number {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (v << 12) | rem;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function dataCapacity(v: number): number {
  return EC_M[v].blocks.reduce((s, [n, d]) => s + n * d, 0);
}

/** Data codewords for byte mode, padded to the version's capacity. */
export function encodeData(bytes: Uint8Array, v: number): number[] {
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCapacity(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < dataCapacity(v); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Split into blocks, add EC codewords, interleave. */
export function interleave(data: readonly number[], v: number): number[] {
  const { ecPerBlock, blocks } = EC_M[v];
  const div = rsDivisor(ecPerBlock);
  const dataBlocks: number[][] = [];
  let k = 0;
  for (const [n, d] of blocks) for (let i = 0; i < n; i++) { dataBlocks.push(data.slice(k, k + d)); k += d; }
  const ecBlocks = dataBlocks.map((b) => rsRemainder(b, div));
  const out: number[] = [];
  const maxD = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxD; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of ecBlocks) out.push(b[i]);
  return out;
}

export interface QrCode { version: number; size: number; mask: number; modules: boolean[][] }

export function encodeQr(text: string, opts: { mask?: number } = {}): QrCode {
  const bytes = new TextEncoder().encode(text);
  const version = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((v) => 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCapacity(v) * 8);
  if (!version) throw new Error(`QR: ${bytes.length} bytes is too long for versions 1–10 at level M`);
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx; const y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); }
    }
  }
  const al = ALIGN[version];
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask: number) => {
    const b = formatBits(mask);
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
    set(8, size - 8, true);
  };
  drawFormat(0); // reserve the format areas before placing data
  if (version >= 7) {
    const b = versionBits(version);
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3); const c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); }
  }

  const codewords = interleave(encodeData(bytes, version), version);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vert : vert;
      if (!fn[y][x] && i < codewords.length * 8) { modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7)); i++; }
    }
  }

  const masked = (mask: number) => {
    const m = modules.map((r) => [...r]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (fn[y][x]) continue;
      const inv = [
        (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
        (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0,
        (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
      ][mask];
      if (inv) m[y][x] = !m[y][x];
    }
    return m;
  };
  const withFormat = (m: boolean[][], mask: number) => {
    const saved = modules.map((r) => [...r]);
    for (let y = 0; y < size; y++) modules[y] = m[y];
    drawFormat(mask);
    const out = modules.map((r) => [...r]);
    for (let y = 0; y < size; y++) modules[y] = saved[y];
    return out;
  };

  let best = { mask: 0, score: Infinity, m: modules };
  for (const mask of opts.mask !== undefined ? [opts.mask] : [0, 1, 2, 3, 4, 5, 6, 7]) {
    const m = withFormat(masked(mask), mask);
    const score = penalty(m);
    if (score < best.score) best = { mask, score, m };
  }
  return { version, size, mask: best.mask, modules: best.m };
}

/** ISO 18004 mask penalty (N1 = 3, N2 = 3, N3 = 40, N4 = 10). */
export function penalty(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  const lines = [...m, ...m[0].map((_, x) => m.map((r) => r[x]))];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++;
      else { if (run >= 5) p += 3 + run - 5; run = 1; }
    }
    const s = line.map((b) => (b ? '1' : '0')).join('');
    for (const pat of ['10111010000', '00001011101']) for (let k = s.indexOf(pat); k >= 0; k = s.indexOf(pat, k + 1)) p += 40;
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  const dark = m.flat().filter(Boolean).length;
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

/** SVG with a 4-module quiet zone. */
export function qrSvg(text: string, modulePx = 4): string {
  const q = encodeQr(text);
  const dim = (q.size + 8) * modulePx;
  let path = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) path += `M${(x + 4) * modulePx},${(y + 4) * modulePx}h${modulePx}v${modulePx}h-${modulePx}z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
