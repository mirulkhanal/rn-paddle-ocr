/**
 * Static model path resolver using project assets
 * This file now statically references the model files located in `src/assets`
 * and returns them via `require()` so Metro bundler includes them.
 */

// Static requires for Metro bundler (these assets live in `src/assets`)
const detModelAsset = require('../assets/exported_det/inference.onnx');
const recModelAsset = require('../assets/exported_rec/inference.onnx');
const characterDictAsset = require('../assets/character_dict.json');

/**
 * Get the path/asset for the detection model
 */
export function getDetModelPath(): string | number {
  return detModelAsset;
}

/**
 * Get the path/asset for the recognition model
 */
export function getRecModelPath(): string | number {
  return recModelAsset;
}

/**
 * Get the path (string) to the character dictionary file (useful for file-based adapters)
 */
export function getCharacterDictPath(): string {
  return '../assets/character_dict.json';
}

/**
 * Get all default model assets (det/rec assets and inlined character dictionary)
 */
export function getDefaultModelPaths(): {
  detModelPath: string | number;
  recModelPath: string | number;
  characterDict?: string[];
} {
  return {
    detModelPath: detModelAsset,
    recModelPath: recModelAsset,
    characterDict: Array.isArray(characterDictAsset) ? characterDictAsset : undefined
  };
}
