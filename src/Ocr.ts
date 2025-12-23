// @ts-ignore - expo-asset is provided by consuming Expo app
import { Asset } from 'expo-asset';
import { ReceiptOCR } from './ReceiptOCR';
import { OcrConfig } from './types/OcrConfig.interface';
import { OcrResult } from './types/OcrResult.interface';

const DET_MODEL = require('./assets/exported_det/inference.onnx');
const REC_MODEL = require('./assets/exported_rec/inference.onnx');
const CHARACTER_DICT = require('./assets/character_dict.json');

let ocrInstance: ReceiptOCR | null = null;
let isInitialized = false;

async function ensureInitialized(config?: OcrConfig): Promise<void> {
  if (isInitialized && ocrInstance) {
    return;
  }

  if (!config) {
    const detAsset = Asset.fromModule(DET_MODEL);
    const recAsset = Asset.fromModule(REC_MODEL);

    await Promise.all([detAsset.downloadAsync(), recAsset.downloadAsync()]);

    const detPath = detAsset.localUri;
    const recPath = recAsset.localUri;

    if (!detPath || !recPath) {
      throw new Error('Failed to resolve bundled model paths. Ensure expo-asset is properly configured.');
    }

    const characterDict: string[] = CHARACTER_DICT;
    if (!Array.isArray(characterDict) || !characterDict.every(v => typeof v === 'string')) {
      throw new Error('Invalid bundled character dictionary format.');
    }

    ocrInstance = new ReceiptOCR();
    await ocrInstance.loadModel(detPath);
    await ocrInstance.loadRecognitionModel(recPath);
    await ocrInstance.loadCharacterDictFromArray(characterDict);
  } else {
    if (!config.detModelPath || !config.recModelPath) {
      throw new Error('detModelPath and recModelPath are required in config.');
    }

    if (!config.characterDict && !config.characterDictPath) {
      throw new Error('Either characterDict or characterDictPath must be provided in config.');
    }

    ocrInstance = new ReceiptOCR(config.fileSystemAdapter);
    await ocrInstance.loadModel(config.detModelPath);
    await ocrInstance.loadRecognitionModel(config.recModelPath);

    if (config.characterDict) {
      await ocrInstance.loadCharacterDictFromArray(config.characterDict);
    } else if (config.characterDictPath) {
      await ocrInstance.loadCharacterDict(config.characterDictPath);
    }
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
