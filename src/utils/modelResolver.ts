/**
 * React Native/Expo compatible model path resolver
 * Uses the static assets referenced in `src/utils/modelPaths.ts` by default.
 */

import { OcrConfig } from '../types/OcrConfig.interface';
import { getDefaultModelPaths } from './modelPaths';

/**
 * Attempts to resolve default bundled models (now statically provided in assets)
 * Returns model config if successful, null if something unexpected occurs
 */
export function tryResolveDefaultModels(): Partial<OcrConfig> | null {
  const paths = getDefaultModelPaths();

  // Our static asset resolver returns asset references and an inlined character dict
  if (paths.characterDict && (typeof paths.detModelPath === 'number' || typeof paths.detModelPath === 'string')) {
    return {
      detModelPath: paths.detModelPath,
      recModelPath: paths.recModelPath,
      characterDict: paths.characterDict
    };
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

  // Try to resolve default bundled models (static assets)
  const defaults = tryResolveDefaultModels();

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
      'Failed to resolve models. Provide `detModelPath` and `recModelPath`, or ensure assets in `src/assets` are present.'
    );
  }

  if (!resolved.characterDict && !resolved.characterDictPath) {
    throw new Error(
      'Character dictionary required. Provide either `characterDict` (array) or `characterDictPath`.'
    );
  }

  return resolved;
}