import { XY } from '../types/XY.interface';

function solveHomography(src: XY[], dst: XY[]): number[] {
  if (src.length !== 4 || dst.length !== 4) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const M: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    M.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    M.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  if (M.length !== 8 || b.length !== 8) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const n = 8;
  for (let i = 0; i < n; i++) {
    if (!M[i] || M[i].length < n) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let maxR = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[maxR][i])) maxR = r;
    }
    if (maxR !== i) {
      const tmpRow = M[i]; M[i] = M[maxR]; M[maxR] = tmpRow;
      const tmpB = b[i]; b[i] = b[maxR]; b[maxR] = tmpB;
    }
    const piv = M[i][i];
    if (Math.abs(piv) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let c = i; c < n; c++) M[i][c] /= piv;
    b[i] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      if (Math.abs(f) < 1e-18) continue;
      for (let c = i; c < n; c++) M[r][c] -= f * M[i][c];
      b[r] -= f * b[i];
    }
  }
  const h = new Array<number>(9);
  h[0] = b[0]; h[1] = b[1]; h[2] = b[2];
  h[3] = b[3]; h[4] = b[4]; h[5] = b[5];
  h[6] = b[6]; h[7] = b[7];
  h[8] = 1;
  return h;
}

function bilinearSample(
  src: Uint8Array,
  sw: number,
  sh: number,
  x: number,
  y: number
): [number, number, number] {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const ix1 = clamp(ix, 0, sw - 1);
  const iy1 = clamp(iy, 0, sh - 1);
  const ix2 = clamp(ix + 1, 0, sw - 1);
  const iy2 = clamp(iy + 1, 0, sh - 1);

  const idx = (xx: number, yy: number) => (yy * sw + xx) * 4;
  const i11 = idx(ix1, iy1);
  const i21 = idx(ix2, iy1);
  const i12 = idx(ix1, iy2);
  const i22 = idx(ix2, iy2);

  const w11 = (1 - fx) * (1 - fy);
  const w21 = fx * (1 - fy);
  const w12 = (1 - fx) * fy;
  const w22 = fx * fy;

  const r =
    src[i11] * w11 + src[i21] * w21 + src[i12] * w12 + src[i22] * w22;
  const g =
    src[i11 + 1] * w11 + src[i21 + 1] * w21 + src[i12 + 1] * w12 + src[i22 + 1] * w22;
  const b =
    src[i11 + 2] * w11 + src[i21 + 2] * w21 + src[i12 + 2] * w12 + src[i22 + 2] * w22;
  return [r, g, b];
}

export function warpQuadToRect(
  srcPixels: Uint8Array,
  srcW: number,
  srcH: number,
  quad: XY[],
  dstW: number,
  dstH: number
): Uint8Array {
  const dstPixels = new Uint8Array(dstW * dstH * 4);
  const dstQuad: XY[] = [
    { x: 0, y: 0 },
    { x: dstW - 1, y: 0 },
    { x: dstW - 1, y: dstH - 1 },
    { x: 0, y: dstH - 1 },
  ];
  const H = solveHomography(dstQuad, quad);

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const u = (H[0] * x + H[1] * y + H[2]) / (H[6] * x + H[7] * y + H[8]);
      const v = (H[3] * x + H[4] * y + H[5]) / (H[6] * x + H[7] * y + H[8]);
      const [r, g, b] = bilinearSample(srcPixels, srcW, srcH, u, v);
      const idx = (y * dstW + x) * 4;
      dstPixels[idx] = r;
      dstPixels[idx + 1] = g;
      dstPixels[idx + 2] = b;
      dstPixels[idx + 3] = 255;
    }
  }
  return dstPixels;
}

