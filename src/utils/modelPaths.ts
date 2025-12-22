/**
 * Export resolved paths to bundled models
 * This allows consumers to access models from the installed package
 */

/**
 * Try to require bundled models using package-relative paths
 * This works when Metro bundler can resolve these assets
 * We try multiple path strategies to handle different build/bundle scenarios
 */
function tryRequireBundledModels(): {
  detModelPath: number | string;
  recModelPath: number | string;
  characterDict: string[] | undefined;
} | null {
  // Strategy 1: Try relative paths from built code (build/utils/modelPaths.js -> models/)
  // Path: ../../models/... (from build/utils/)
  try {
    const detModel1 = require('../../models/exported_det/inference.onnx');
    const recModel1 = require('../../models/exported_rec/inference.onnx');
    const characterDict1 = require('../../models/character_dict.json');
    
    if (detModel1 != null && recModel1 != null && characterDict1 != null) {
      return {
        detModelPath: detModel1,
        recModelPath: recModel1,
        characterDict: Array.isArray(characterDict1) ? characterDict1 : undefined
      };
    }
  } catch {
    // Continue to next strategy
  }
  
  // Strategy 2: Try using package name (works if Metro resolves node_modules)
  try {
    const detModel2 = require('@mirulkhanall/rn-paddle-ocr/models/exported_det/inference.onnx');
    const recModel2 = require('@mirulkhanall/rn-paddle-ocr/models/exported_rec/inference.onnx');
    const characterDict2 = require('@mirulkhanall/rn-paddle-ocr/models/character_dict.json');
    
    if (detModel2 != null && recModel2 != null && characterDict2 != null) {
      return {
        detModelPath: detModel2,
        recModelPath: recModel2,
        characterDict: Array.isArray(characterDict2) ? characterDict2 : undefined
      };
    }
  } catch {
    // Continue to next strategy
  }
  
  // Strategy 3: Try relative paths from source (src/utils/modelPaths.ts -> models/)
  // Path: ../models/... (from src/utils/)
  try {
    const detModel3 = require('../models/exported_det/inference.onnx');
    const recModel3 = require('../models/exported_rec/inference.onnx');
    const characterDict3 = require('../models/character_dict.json');
    
    if (detModel3 != null && recModel3 != null && characterDict3 != null) {
      return {
        detModelPath: detModel3,
        recModelPath: recModel3,
        characterDict: Array.isArray(characterDict3) ? characterDict3 : undefined
      };
    }
  } catch {
    // All strategies failed
  }
  
  return null;
}

/**
 * Get the package root directory
 * Uses require.resolve to find where the package is installed
 */
function getPackageRoot(): string {
  try {
    // Resolve the package.json to find the package location
    const packageJsonPath = require.resolve('@mirulkhanall/rn-paddle-ocr/package.json');
    // Extract directory path (remove 'package.json' from end)
    const parts = packageJsonPath.split('/');
    parts.pop(); // Remove 'package.json'
    return parts.join('/');
  } catch (error) {
    throw new Error(
      `Failed to locate @mirulkhanall/rn-paddle-ocr package. Make sure it's installed. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the path to the detection model
 */
export function getDetModelPath(): string {
  const packageRoot = getPackageRoot();
  return `${packageRoot}/models/exported_det/inference.onnx`;
}

/**
 * Get the path to the recognition model
 */
export function getRecModelPath(): string {
  const packageRoot = getPackageRoot();
  return `${packageRoot}/models/exported_rec/inference.onnx`;
}

/**
 * Get the path to the character dictionary
 */
export function getCharacterDictPath(): string {
  const packageRoot = getPackageRoot();
  return `${packageRoot}/models/character_dict.json`;
}

/**
 * Get all default model paths or asset references
 * Tries to use require() first (works if Metro is configured),
 * falls back to file system paths
 */
export function getDefaultModelPaths(): {
  detModelPath: string | number;
  recModelPath: string | number;
  characterDictPath?: string;
  characterDict?: string[];
} {
  // First, try to use require() to get bundled asset references
  // This works when Metro bundler can resolve the assets
  const bundledModels = tryRequireBundledModels();
  if (bundledModels) {
    return {
      detModelPath: bundledModels.detModelPath,
      recModelPath: bundledModels.recModelPath,
      characterDict: bundledModels.characterDict
    };
  }
  
  // Fallback to file system paths (may not work in all React Native environments)
  return {
    detModelPath: getDetModelPath(),
    recModelPath: getRecModelPath(),
    characterDictPath: getCharacterDictPath()
  };
}

