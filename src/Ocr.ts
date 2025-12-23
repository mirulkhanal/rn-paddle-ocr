import { ReceiptOCR } from './ReceiptOCR';
import { OcrConfig } from './types/OcrConfig.interface';
import { OcrResult } from './types/OcrResult.interface';

let ocrInstance: ReceiptOCR | null = null;
let isInitialized = false;
let cachedConfig: OcrConfig | null = null;

async function ensureInitialized(config?: OcrConfig): Promise<void> {
  if (isInitialized && ocrInstance) {
    return;
  }

  const effectiveConfig = config ?? cachedConfig;
  if (!effectiveConfig) {
    throw new Error('OCR not initialized. Call Ocr.init(config) first or pass config to Ocr.scan(imagePath, config).');
  }

  cachedConfig = effectiveConfig;

  ocrInstance = new ReceiptOCR(effectiveConfig.runtime, effectiveConfig.fileSystemAdapter);
  await ocrInstance.loadModel(effectiveConfig.detModelPath);
  await ocrInstance.loadRecognitionModel(effectiveConfig.recModelPath);
  await ocrInstance.loadCharacterDictFromArray(effectiveConfig.characterDict);

  isInitialized = true;
}

export const Ocr = {
  async init(config: OcrConfig): Promise<void> {
    await ensureInitialized(config);
  },

  async scan(imagePath: string, config?: OcrConfig): Promise<OcrResult[]> {
    await ensureInitialized(config);
    
    if (!ocrInstance) {
      throw new Error('OCR instance not available');
    }

    return ocrInstance.processAndRecognize(imagePath);
  }
};
