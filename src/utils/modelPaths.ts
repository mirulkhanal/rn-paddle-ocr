/**
 * Export resolved paths to bundled models
 * This allows consumers to access models from the installed package
 */

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
 * Get all default model paths
 */
export function getDefaultModelPaths(): {
  detModelPath: string;
  recModelPath: string;
  characterDictPath: string;
} {
  return {
    detModelPath: getDetModelPath(),
    recModelPath: getRecModelPath(),
    characterDictPath: getCharacterDictPath()
  };
}

