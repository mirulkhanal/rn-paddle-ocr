import { DetResizeMeta } from './postprocess/DetResizeMeta';
import { DBPostProcessor } from './postprocess/DBPostProcessor';
import { ImageUtils } from './utils/ImageUtils';
import { warpQuadToRect } from './utils/WarpPerspective';
import { Buffer } from 'buffer';
import { Box } from './types/Box.interface';
import { OcrResult } from './types/OcrResult.interface';
import { FileSystemAdapter } from './types/FileSystemAdapter.interface';

// Lazy load onnxruntime-react-native to avoid native module initialization issues
// Using require with lazy evaluation to prevent immediate native module initialization
let ortModule: any = null;

function getOrt(): any {
  if (!ortModule) {
    try {
      ortModule = require('onnxruntime-react-native');
      if (!ortModule || !ortModule.InferenceSession || !ortModule.Tensor) {
        throw new Error('onnxruntime-react-native module is not properly loaded');
      }
    } catch (error) {
      throw new Error(
        `Failed to load onnxruntime-react-native. Make sure it's installed and properly linked: npm install onnxruntime-react-native. ` +
        `You may need to rebuild your app after installing native dependencies. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return ortModule;
}

export class ReceiptOCR {
  private detSession: any | null = null;
  private recSession: any | null = null;
  private postProcessor: DBPostProcessor;
  private characterDict: string[] | null = null;
  private fsAdapter: FileSystemAdapter | null = null;

  constructor(fileSystemAdapter?: FileSystemAdapter) {
    this.postProcessor = new DBPostProcessor();
    this.fsAdapter = fileSystemAdapter || null;
  }

  async loadCharacterDictFromArray(dict: string[]): Promise<void> {
    if (!Array.isArray(dict) || !dict.every(v => typeof v === 'string')) {
      throw new Error('Invalid character dict: expected string[]');
    }
    this.characterDict = dict;
  }

  private async getImageBytes(imagePath: string): Promise<Uint8Array> {
    if (imagePath.startsWith('data:image/')) {
      const m = imagePath.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.*)$/i);
      if (!m) throw new Error('Invalid base64 image string');
      const base64 = m[2];
      const buf = Buffer.from(base64, 'base64');
      return new Uint8Array(buf);
    }
    
    if (this.fsAdapter) {
      const base64 = await this.fsAdapter.readAsStringAsync(imagePath, { encoding: 'base64' });
      const buf = Buffer.from(base64, 'base64');
      return new Uint8Array(buf);
    }
    
    throw new Error('No file system adapter provided. Pass fileSystemAdapter in config or use base64 data URI.');
  }

  async processAndRecognize(imagePath: string): Promise<OcrResult[]> {
    const boxes = await this.processImage(imagePath);
    if (!this.recSession) {
      throw new Error('Recognition model not loaded. Call loadRecognitionModel() first.');
    }
    if (!this.characterDict) {
      throw new Error('Character dict not loaded. Call loadCharacterDict() first.');
    }

    const raw = await this.getImageBytes(imagePath);
    const decoded = ImageUtils.decodeJpeg(raw);

    const results: OcrResult[] = [];
    for (const box of boxes) {
      const pts = box.points;
      const wTop = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const wBot = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
      const hLeft = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
      const hRight = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
      const avgW = (wTop + wBot) / 2;
      const avgH = (hLeft + hRight) / 2;
      const targetH = 48;
      let targetW = Math.max(16, Math.round((avgW / Math.max(1, avgH)) * targetH));
      targetW = Math.min(targetW, 320);

      const crop = warpQuadToRect(
        decoded.data,
        decoded.width,
        decoded.height,
        pts,
        targetW,
        targetH
      );

      const floatData = ImageUtils.pixelsToNCHW(crop, targetW, targetH);
      const ort = getOrt();
      const inputTensor = new ort.Tensor('float32', floatData, [1, 3, targetH, targetW]);

      const feeds: Record<string, any> = {};
      const inputNames = this.recSession.inputNames;
      feeds[inputNames[0]] = inputTensor;

      const outputMap = await this.recSession.run(feeds);
      const outputNames = this.recSession.outputNames;
      const outputTensor = outputMap[outputNames[0]] as any;
      const dims = outputTensor.dims;

      const timeSteps = dims[dims.length - 2] ?? 0;
      const classes = dims[dims.length - 1] ?? 0;
      const data = outputTensor.data;
      const expected = timeSteps * classes;

      const { text, confidence } = this.decodeCTCGreedy(
        data.subarray(0, expected),
        timeSteps,
        classes,
        this.characterDict
      );

      results.push({ box, text, confidence });
    }

    return results;
  }

  async loadModel(modelPath: string | number): Promise<void> {
    try {
      const ort = getOrt();
      this.detSession = await ort.InferenceSession.create(modelPath);
    } catch (e) {
      throw new Error(`Failed to load detection model: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async loadRecognitionModel(modelPath: string | number): Promise<void> {
    try {
      const ort = getOrt();
      this.recSession = await ort.InferenceSession.create(modelPath);
    } catch (e) {
      throw new Error(`Failed to load recognition model: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async loadCharacterDict(dictPath: string): Promise<void> {
    let raw: string;
    
    if (this.fsAdapter) {
      raw = await this.fsAdapter.readAsStringAsync(dictPath, { encoding: 'utf8' });
    } else {
      throw new Error('No file system adapter provided. Pass fileSystemAdapter in config or use characterDict array.');
    }
    
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(v => typeof v === 'string')) {
      throw new Error('Invalid character_dict.json format');
    }
    this.characterDict = parsed;
  }

  async processImage(imagePath: string): Promise<Box[]> {
    if (!this.detSession) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const raw = await this.getImageBytes(imagePath);
    const decoded = ImageUtils.decodeJpeg(raw);
    const origW = decoded.width;
    const origH = decoded.height;

    const resizeMeta = DetResizeMeta.computeDetResizeMeta(origH, origW);

    const resizedPixels = ImageUtils.resizeBilinearRGBA(
      decoded.data,
      decoded.width,
      decoded.height,
      resizeMeta.resizeW,
      resizeMeta.resizeH
    );

    const padW = resizeMeta.padW;
    const padH = resizeMeta.padH;
    const padded = ImageUtils.padRGBA(resizedPixels, resizeMeta.resizeW, resizeMeta.resizeH, padW, padH);
    const floatData = ImageUtils.pixelsToNCHW(padded, padW, padH);

    const ort = getOrt();
    const inputTensor = new ort.Tensor('float32', floatData, [1, 3, padH, padW]);

    const feeds: Record<string, any> = {};
    const inputNames = this.detSession.inputNames;
    feeds[inputNames[0]] = inputTensor;

    const outputMap = await this.detSession.run(feeds);
    const outputNames = this.detSession.outputNames;
    const outputTensor = outputMap[outputNames[0]] as any;

    const { pred, width, height } = this.extractDetMap(outputTensor);
    const cropW = resizeMeta.resizeW;
    const cropH = resizeMeta.resizeH;
    const cropped = new Float32Array(cropW * cropH);
    const minW = Math.min(cropW, width);
    const minH = Math.min(cropH, height);
    for (let y = 0; y < minH; y++) {
      const srcRow = y * width;
      const dstRow = y * cropW;
      for (let x = 0; x < minW; x++) {
        cropped[dstRow + x] = pred[srcRow + x];
      }
    }
    const boxes = this.postProcessor.process(cropped, cropW, cropH, resizeMeta);

    return boxes;
  }

  private extractDetMap(outputTensor: any): { pred: Float32Array; width: number; height: number } {
    const dims = outputTensor.dims;
    if (dims.length < 2) {
      throw new Error(`Unexpected output dims: [${dims.join(', ')}]`);
    }

    const height = dims[dims.length - 2] ?? 0;
    const width = dims[dims.length - 1] ?? 0;
    const stride = width * height;

    const data = outputTensor.data;
    if (data.length < stride) {
      throw new Error(`Unexpected output size: data=${data.length}, expected>=${stride}`);
    }

    if (dims.length === 4) {
      const channels = dims[1] ?? 1;
      if (channels > 1) {
        throw new Error(`Unsupported detection output channels: ${channels} (expected 1)`);
      }
    }

    return { pred: data.subarray(0, stride), width, height };
  }

  private decodeCTCGreedy(
    probs: Float32Array,
    timeSteps: number,
    classes: number,
    dict: string[]
  ): { text: string; confidence: number } {
    const blank = 0;
    let prev = -1;
    let text = '';
    let confSum = 0;
    let confCount = 0;

    for (let t = 0; t < timeSteps; t++) {
      let bestIdx = 0;
      let bestProb = probs[t * classes];
      const base = t * classes;

      for (let c = 1; c < classes; c++) {
        const p = probs[base + c];
        if (p > bestProb) {
          bestProb = p;
          bestIdx = c;
        }
      }

      if (bestIdx !== blank && bestIdx !== prev) {
        const dictIdx = bestIdx - 1;
        if (dictIdx >= 0 && dictIdx < dict.length) {
          text += dict[dictIdx];
          confSum += bestProb;
          confCount++;
        }
      }

      prev = bestIdx;
    }

    return { text, confidence: confCount === 0 ? 0 : confSum / confCount };
  }
}

