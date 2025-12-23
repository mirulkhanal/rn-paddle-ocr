/**
 * Static model path resolver using project assets
 * This file now statically references the model files located in `src/assets`
 * and returns them via `require()` so Metro bundler includes them.
 */

/**
 * Try to require bundled models using multiple path strategies
 * This makes resolution robust when the package is consumed from node_modules
 */
function tryRequireBundledModels(): {
  detModelPath: number | string;
  recModelPath: number | string;
  characterDict: string[] | undefined;
} | null {
  // Strategy A: built package 'models' folder (from build/utils -> ../../models)
  try {
    const detA = require('../../models/exported_det/inference.onnx');
    const recA = require('../../models/exported_rec/inference.onnx');
    const charA = require('../../models/character_dict.json');
    if (detA != null && recA != null && charA != null) {
      return {
        detModelPath: detA,
        recModelPath: recA,
        characterDict: Array.isArray(charA) ? charA : undefined
      };
    }
  } catch {
    // continue
  }

  // Strategy B: package name 'models' (node_modules package layout)
  try {
    const detB = require('@mirulkhanall/rn-paddle-ocr/models/exported_det/inference.onnx');
    const recB = require('@mirulkhanall/rn-paddle-ocr/models/exported_rec/inference.onnx');
    const charB = require('@mirulkhanall/rn-paddle-ocr/models/character_dict.json');
    if (detB != null && recB != null && charB != null) {
      return {
        detModelPath: detB,
        recModelPath: recB,
        characterDict: Array.isArray(charB) ? charB : undefined
      };
    }
  } catch {
    // continue
  }

  // Strategy C: assets folder inside package (build relative)
  try {
    const detC = require('../assets/exported_det/inference.onnx');
    const recC = require('../assets/exported_rec/inference.onnx');
    const charC = require('../assets/character_dict.json');
    if (detC != null && recC != null && charC != null) {
      return {
        detModelPath: detC,
        recModelPath: recC,
        characterDict: Array.isArray(charC) ? charC : undefined
      };
    }
  } catch {
    // continue
  }

  // Strategy D: package name assets folder
  try {
    const detD = require('@mirulkhanall/rn-paddle-ocr/assets/exported_det/inference.onnx');
    const recD = require('@mirulkhanall/rn-paddle-ocr/assets/exported_rec/inference.onnx');
    const charD = require('@mirulkhanall/rn-paddle-ocr/assets/character_dict.json');
    if (detD != null && recD != null && charD != null) {
      return {
        detModelPath: detD,
        recModelPath: recD,
        characterDict: Array.isArray(charD) ? charD : undefined
      };
    }
  } catch {
    // continue
  }

  return null;
}

/**
 * Get the package root directory
 */
function getPackageRoot(): string {
  try {
    const packageJsonPath = require.resolve('@mirulkhanall/rn-paddle-ocr/package.json');
    const parts = packageJsonPath.split('/');
    parts.pop();
    return parts.join('/');
  } catch (error) {
    throw new Error(
      `Failed to locate @mirulkhanall/rn-paddle-ocr package. Make sure it's installed. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the path to the detection model (file system fallback)
 */
export function getDetModelPath(): string {
  const packageRoot = getPackageRoot();
  // Prefer models/ layout historically used in package
  return `${packageRoot}/models/exported_det/inference.onnx`;
}

/**
 * Get the path to the recognition model (file system fallback)
 */
export function getRecModelPath(): string {
  const packageRoot = getPackageRoot();
  return `${packageRoot}/models/exported_rec/inference.onnx`;
}

/**
 * Get the path to the character dictionary (file system fallback)
 */
export function getCharacterDictPath(): string {
  const packageRoot = getPackageRoot();
  return `${packageRoot}/models/character_dict.json`;
}

/**
 * Get all default model paths or asset references
 */
export function getDefaultModelPaths(): {
  detModelPath: string | number;
  recModelPath: string | number;
  characterDictPath?: string;
  characterDict?: string[];
} {
  // First try bundled requires (works with Metro)
  const bundled = tryRequireBundledModels();
  if (bundled) {
    return {
      detModelPath: bundled.detModelPath,
      recModelPath: bundled.recModelPath,
      characterDict: bundled.characterDict
    };
  }

  // Fallback to file-system paths
  return {
    detModelPath: getDetModelPath(),
    recModelPath: getRecModelPath(),
    characterDictPath: getCharacterDictPath()
  };
}
