/**
 * React Native/Expo compatible model path resolver
 * Automatically resolves bundled models when no paths are provided
 */

import { OcrConfig } from '../types/OcrConfig.interface';
import { getDefaultModelPaths } from './modelPaths';

/**
 * Attempts to resolve default bundled models
 * Returns model config if successful, null if models not accessible
 * Tries require() first (works with Metro bundler), then falls back to file system paths
 */
export function tryResolveDefaultModels(config: OcrConfig): Partial<OcrConfig> | null {
  // Strategy 1: Try to use require() to get bundled asset references
  // This is the preferred approach for React Native/Expo as it works with Metro bundler
  // We try this first regardless of fileSystemAdapter since onnxruntime can handle asset IDs directly
  const paths = getDefaultModelPaths();
  
  // If getDefaultModelPaths() successfully used require() and got asset references
  // (indicated by having characterDict array instead of characterDictPath)
  if (paths.characterDict && (typeof paths.detModelPath === 'number' || typeof paths.detModelPath === 'string')) {
    return {
      detModelPath: paths.detModelPath,
      recModelPath: paths.recModelPath,
      characterDict: paths.characterDict
    };
  }
  
  // Strategy 2: If require() failed but fileSystemAdapter is provided,
  // try using file system paths (may work in some environments)
  if (config.fileSystemAdapter && paths.characterDictPath) {
    try {
      return {
        detModelPath: paths.detModelPath,
        recModelPath: paths.recModelPath,
        characterDictPath: paths.characterDictPath
      };
    } catch (error) {
      // File system paths might not work in React Native, but we return them anyway
      // The actual error will occur when trying to load the models
      return {
        detModelPath: paths.detModelPath,
        recModelPath: paths.recModelPath,
        characterDictPath: paths.characterDictPath
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
    const hasFileSystemAdapter = !!config.fileSystemAdapter;
    const errorMessage = hasFileSystemAdapter
      ? 'Failed to automatically resolve bundled models. ' +
        'React Native/Expo requires models to be bundled as assets. ' +
        'Please do one of the following:\n' +
        '1. Copy models to your app assets folder and use require():\n' +
        '   await Ocr.init({\n' +
        '     detModelPath: require("./assets/models/inference_det.onnx"),\n' +
        '     recModelPath: require("./assets/models/inference_rec.onnx"),\n' +
        '     characterDict: require("./assets/models/character_dict.json"),\n' +
        '     fileSystemAdapter: FileSystem\n' +
        '   });\n' +
        '2. Configure Metro bundler to bundle .onnx files from node_modules (see package README)\n' +
        '3. Use file paths if models are accessible via fileSystemAdapter'
      : 'Model paths required. Please provide detModelPath and recModelPath, ' +
        'or provide fileSystemAdapter to attempt automatic resolution. ' +
        'Example: Ocr.init({ fileSystemAdapter: FileSystem })';
    
    throw new Error(errorMessage);
  }
  
  if (!resolved.characterDict && !resolved.characterDictPath) {
    throw new Error(
      'Character dictionary required. Provide either characterDict (array) or characterDictPath (with fileSystemAdapter). ' +
      'When using require() for models, use characterDict array. ' +
      'When using file paths, use characterDictPath with fileSystemAdapter.'
    );
  }
  
  return resolved;
}
