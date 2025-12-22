/**
 * React Native/Expo compatible model path resolver
 * Automatically resolves bundled models when no paths are provided
 */

import { OcrConfig } from '../types/OcrConfig.interface';

/**
 * Gets the path to the installed package root
 */
function getPackageRoot(): string | null {
  try {
    // Resolve the package.json to find where the package is installed
    const packageJsonPath = require.resolve('@mirulkhanall/rn-paddle-ocr/package.json');
    // Use path.dirname to get the package root directory
    // Note: We can't use 'path' module in React Native, so we'll use string manipulation
    const parts = packageJsonPath.split('/');
    // Remove 'package.json' from the end
    parts.pop();
    return parts.join('/');
  } catch {
    return null;
  }
}

/**
 * Attempts to resolve default bundled models
 * Returns model config if successful, null if models not accessible
 */
export function tryResolveDefaultModels(config: OcrConfig): Partial<OcrConfig> | null {
  // Approach 1: Try require() - works if Metro bundler is configured for .onnx files
  try {
    const detModel = require('@mirulkhanall/rn-paddle-ocr/models/exported_det/inference.onnx');
    const recModel = require('@mirulkhanall/rn-paddle-ocr/models/exported_rec/inference.onnx');
    const characterDict = require('@mirulkhanall/rn-paddle-ocr/models/character_dict.json');
    
    if (detModel && recModel && characterDict) {
      return {
        detModelPath: detModel,
        recModelPath: recModel,
        characterDict: Array.isArray(characterDict) ? characterDict : undefined
      };
    }
  } catch {
    // Continue to next approach
  }
  
  // Approach 2: Use file system adapter to read from installed package location
  // This works because models are published with the package (in package.json "files" array)
  if (config.fileSystemAdapter) {
    const packageRoot = getPackageRoot();
    if (packageRoot) {
      return {
        detModelPath: `${packageRoot}/models/exported_det/inference.onnx`,
        recModelPath: `${packageRoot}/models/exported_rec/inference.onnx`,
        characterDictPath: `${packageRoot}/models/character_dict.json`
      };
    }
  }
  
  return null;
}

/**
 * Resolves model configuration, using bundled models if not provided
 */
export function resolveModelConfig(config: OcrConfig): OcrConfig {
  // If user provided all required models, use them (user config takes precedence)
  if (config.detModelPath && config.recModelPath && (config.characterDict || config.characterDictPath)) {
    return config;
  }
  
  // Try to resolve default bundled models
  const defaults = tryResolveDefaultModels(config);
  
  // Merge user config with defaults (user config takes precedence, defaults fill gaps)
  const resolved: OcrConfig = {
    ...defaults,
    ...config,
    detModelPath: config.detModelPath ?? defaults?.detModelPath,
    recModelPath: config.recModelPath ?? defaults?.recModelPath,
    characterDict: config.characterDict ?? defaults?.characterDict,
    characterDictPath: config.characterDictPath ?? defaults?.characterDictPath,
    fileSystemAdapter: config.fileSystemAdapter ?? defaults?.fileSystemAdapter
  };
  
  // Validate that we have all required fields after merging
  if (!resolved.detModelPath || !resolved.recModelPath) {
    throw new Error(
      'Model paths required. Please provide detModelPath and recModelPath, ' +
      'or provide fileSystemAdapter to use bundled models automatically. ' +
      'Example: Ocr.init({ fileSystemAdapter: FileSystem })'
    );
  }
  
  if (!resolved.characterDict && !resolved.characterDictPath) {
    throw new Error(
      'Character dictionary required. Provide either characterDict (array) or characterDictPath (with fileSystemAdapter).'
    );
  }
  
  return resolved;
}
