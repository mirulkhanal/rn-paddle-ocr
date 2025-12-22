import { ReceiptOCR } from './ReceiptOCR';
import { OcrConfig } from './types/OcrConfig.interface';
import { OcrResult } from './types/OcrResult.interface';
import { resolveModelConfig } from './utils/modelResolver';

let ocrInstance: ReceiptOCR | null = null;
let isInitialized = false;

async function ensureInitialized(config?: OcrConfig): Promise<void> {
  if (isInitialized && ocrInstance) {
    return;
  }

  if (!config) {
    throw new Error('OCR not initialized. Call Ocr.init(config) first or pass config to Ocr.scan().');
  }

  // Resolve model config - automatically uses bundled models if paths not provided
  const resolvedConfig = resolveModelConfig(config);

  ocrInstance = new ReceiptOCR(resolvedConfig.fileSystemAdapter);
  
  // Load models - paths are guaranteed to exist after resolution
  await ocrInstance.loadModel(resolvedConfig.detModelPath!);
  await ocrInstance.loadRecognitionModel(resolvedConfig.recModelPath!);
  
  // Load character dictionary
  if (resolvedConfig.characterDict) {
    await ocrInstance.loadCharacterDictFromArray(resolvedConfig.characterDict);
  } else if (resolvedConfig.characterDictPath) {
    await ocrInstance.loadCharacterDict(resolvedConfig.characterDictPath);
  }

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

