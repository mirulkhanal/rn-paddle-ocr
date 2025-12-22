import { DetResizeMeta as DetResizeMetaInterface } from '../types/DetResizeMeta.interface';

export class DetResizeMeta implements DetResizeMetaInterface {
  origH: number;
  origW: number;
  resizeH: number;
  resizeW: number;
  scale: number;
  padH: number;
  padW: number;

  constructor(
    origH: number,
    origW: number,
    resizeH: number,
    resizeW: number,
    scale: number,
    padH: number,
    padW: number
  ) {
    this.origH = origH;
    this.origW = origW;
    this.resizeH = resizeH;
    this.resizeW = resizeW;
    this.scale = scale;
    this.padH = padH;
    this.padW = padW;
  }

  static computeDetResizeMeta(
    origH: number,
    origW: number,
    resizeLong: number = 960
  ): DetResizeMeta {
    const longSide = Math.max(origH, origW);
    const scale = resizeLong / longSide;

    const resizeH = Math.round(origH * scale);
    const resizeW = Math.round(origW * scale);

    const padMultiple = 32;
    const padH = Math.ceil(resizeH / padMultiple) * padMultiple;
    const padW = Math.ceil(resizeW / padMultiple) * padMultiple;

    return new DetResizeMeta(origH, origW, resizeH, resizeW, scale, padH, padW);
  }
}

