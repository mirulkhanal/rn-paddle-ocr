/**
 * React Native/Expo compatible model path resolver
 * Automatically resolves bundled models when no paths are provided
 */

import { OcrConfig } from '../types/OcrConfig.interface';
import { getDefaultModelPaths } from './modelPaths';

/**
 * Attempts to resolve default bundled models
 * Returns model config if successful, null if models not accessible
 */
export function tryResolveDefaultModels(config: OcrConfig): Partial<OcrConfig> | null {
  // If fileSystemAdapter is provided, we can use the bundled models from the package
  if (config.fileSystemAdapter) {
    try {
      const paths = getDefaultModelPaths();
      return {
        detModelPath: paths.detModelPath,
        recModelPath: paths.recModelPath,
        characterDictPath: paths.characterDictPath
      };
    } catch (error) {
      // If we can't get paths, return null and let user provide paths
      return null;
    }
  }
  
  // Try require() approach as fallback (works if Metro bundler is configured for .onnx files)
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
    // Continue - require() approach failed
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
