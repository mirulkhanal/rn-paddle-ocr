/**
 * React Native/Expo compatible model path resolver
 * Attempts to resolve bundled models using require()
 */

import { OcrConfig } from '../types/OcrConfig.interface';

/**
 * Attempts to resolve default bundled models
 * Returns model config if successful, undefined if models not accessible
 */
export function tryResolveDefaultModels(): Partial<OcrConfig> | null {
  try {
    // In React Native/Expo, try to require models from package
    // This works if models are properly configured as assets
    // Note: .onnx files may not work with require() - depends on Metro bundler config
    
    // Attempt to require models - this will throw if not found/not configured
    const detModel = require('@mirulkhanall/rn-paddle-ocr/models/exported_det/inference.onnx');
    const recModel = require('@mirulkhanall/rn-paddle-ocr/models/exported_rec/inference.onnx');
    const characterDict = require('@mirulkhanall/rn-paddle-ocr/models/character_dict.json');
    
    return {
      detModelPath: detModel,
      recModelPath: recModel,
      characterDict: Array.isArray(characterDict) ? characterDict : undefined
    };
  } catch {
    // Models not accessible via require() - user must provide paths
    // This is expected in most React Native setups
    return null;
  }
}

/**
 * Resolves model configuration, using defaults if not provided
 */
export function resolveModelConfig(config: OcrConfig): OcrConfig {
  // If user provided all required models, use them
  if (config.detModelPath && config.recModelPath && (config.characterDict || config.characterDictPath)) {
    return config;
  }
  
  // Try to resolve default models
  const defaults = tryResolveDefaultModels();
  
  if (!defaults) {
    // Default models not accessible - user must provide paths
    if (!config.detModelPath || !config.recModelPath) {
      throw new Error(
        'Model paths required. Please provide detModelPath and recModelPath. ' +
        'Copy models from node_modules/@mirulkhanall/rn-paddle-ocr/models/ to your app assets and use require(), ' +
        'or provide file system paths with fileSystemAdapter.'
      );
    }
    if (!config.characterDict && !config.characterDictPath) {
      throw new Error(
        'Character dictionary required. Provide either characterDict (array) or characterDictPath (with fileSystemAdapter).'
      );
    }
    return config;
  }
  
  // Merge user config with defaults (user config takes precedence)
  return {
    ...defaults,
    ...config,
    detModelPath: config.detModelPath ?? defaults.detModelPath,
    recModelPath: config.recModelPath ?? defaults.recModelPath,
    characterDict: config.characterDict ?? defaults.characterDict,
    characterDictPath: config.characterDictPath ?? defaults.characterDictPath,
    fileSystemAdapter: config.fileSystemAdapter ?? defaults.fileSystemAdapter
  };
}
