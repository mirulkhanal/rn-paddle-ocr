import * as jpeg from 'jpeg-js';

export class ImageUtils {
  static pixelsToNCHW(
    pixels: Uint8Array,
    width: number,
    height: number,
    mean: number[] = [0.485, 0.456, 0.406],
    std: number[] = [0.229, 0.224, 0.225],
    scale: number = 1.0 / 255.0
  ): Float32Array {
    const channels = 3;
    const stride = pixels.length / (width * height);
    const float32Data = new Float32Array(channels * height * width);

    const gOffset = width * height;
    const bOffset = 2 * width * height;

    for (let i = 0; i < width * height; i++) {
      const r = pixels[i * stride] * scale;
      const g = pixels[i * stride + 1] * scale;
      const b = pixels[i * stride + 2] * scale;

      float32Data[i] = (r - mean[0]) / std[0];
      float32Data[gOffset + i] = (g - mean[1]) / std[1];
      float32Data[bOffset + i] = (b - mean[2]) / std[2];
    }

    return float32Data;
  }

  static decodeJpeg(jpegData: Uint8Array): { width: number, height: number, data: Uint8Array } {
      const raw = jpeg.decode(jpegData, { useTArray: true });
      return {
          width: raw.width,
          height: raw.height,
          data: raw.data
      };
  }

  static resizeBilinearRGBA(
    src: Uint8Array,
    sw: number,
    sh: number,
    dw: number,
    dh: number
  ): Uint8Array {
    const out = new Uint8Array(dw * dh * 4);
    for (let y = 0; y < dh; y++) {
      const sy = (y + 0.5) * (sh / dh) - 0.5;
      const y0 = Math.max(0, Math.floor(sy));
      const y1 = Math.min(sh - 1, y0 + 1);
      const fy = sy - y0;
      for (let x = 0; x < dw; x++) {
        const sx = (x + 0.5) * (sw / dw) - 0.5;
        const x0 = Math.max(0, Math.floor(sx));
        const x1 = Math.min(sw - 1, x0 + 1);
        const fx = sx - x0;
        const i00 = (y0 * sw + x0) * 4;
        const i10 = (y0 * sw + x1) * 4;
        const i01 = (y1 * sw + x0) * 4;
        const i11 = (y1 * sw + x1) * 4;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;
        const r = src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11;
        const g = src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11;
        const b = src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11;
        const idx = (y * dw + x) * 4;
        out[idx] = r;
        out[idx + 1] = g;
        out[idx + 2] = b;
        out[idx + 3] = 255;
      }
    }
    return out;
  }

  static padRGBA(
    pixels: Uint8Array,
    width: number,
    height: number,
    padW: number,
    padH: number
  ): Uint8Array {
    const out = new Uint8Array(padW * padH * 4);
    const rowBytesSrc = width * 4;
    const rowBytesDst = padW * 4;
    for (let y = 0; y < height; y++) {
      const srcOffset = y * rowBytesSrc;
      const dstOffset = y * rowBytesDst;
      out.set(pixels.subarray(srcOffset, srcOffset + rowBytesSrc), dstOffset);
      for (let x = width; x < padW; x++) {
        const i = dstOffset + x * 4;
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 255;
      }
    }
    for (let y = height; y < padH; y++) {
      const dstOffset = y * rowBytesDst;
      for (let x = 0; x < padW; x++) {
        const i = dstOffset + x * 4;
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 255;
      }
    }
    return out;
  }
}

