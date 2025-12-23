import { ReceiptOCR } from './ReceiptOCR';
import { OcrConfig } from './types/OcrConfig.interface';
import { OcrResult } from './types/OcrResult.interface';

let ocrInstance: ReceiptOCR | null = null;
let isInitialized = false;

async function ensureInitialized(config?: OcrConfig): Promise<void> {
  if (isInitialized && ocrInstance) {
    return;
  }

  if (!config) {
    throw new Error('OCR not initialized. Call Ocr.init(config) first or pass config to Ocr.scan().');
  }

  // Validate required fields
  if (!config.detModelPath || !config.recModelPath) {
    throw new Error('detModelPath and recModelPath are required in config.');
  }

  if (!config.characterDict && !config.characterDictPath) {
    throw new Error('Either characterDict or characterDictPath must be provided in config.');
  }

  ocrInstance = new ReceiptOCR(config.fileSystemAdapter);
  
  // Load models
  await ocrInstance.loadModel(config.detModelPath);
  await ocrInstance.loadRecognitionModel(config.recModelPath);
  
  // Load character dictionary
  if (config.characterDict) {
    await ocrInstance.loadCharacterDictFromArray(config.characterDict);
  } else if (config.characterDictPath) {
    await ocrInstance.loadCharacterDict(config.characterDictPath);
  }

  isInitialized = true;
}

export const Ocr = {
  async init(config?: OcrConfig): Promise<void> {
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

