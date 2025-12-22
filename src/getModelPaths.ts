import * as path from 'path';

/**
 * Helper function to get default model paths from the installed package
 * This allows apps to use the models bundled with the package
 */
export function getDefaultModelPaths(): {
  detModelPath: string;
  recModelPath: string;
  characterDictPath: string;
} {
  // Find the package root by looking for node_modules/@mirulkhanall/rn-paddle-ocr or using __dirname
  // In a published package, models will be at: node_modules/@mirulkhanall/rn-paddle-ocr/models/
  
  // Try to resolve from package location
  let packageRoot: string;
  try {
    // This works when the package is installed as a dependency
    packageRoot = path.dirname(require.resolve('@mirulkhanall/rn-paddle-ocr/package.json'));
  } catch {
    // Fallback to __dirname for development
    packageRoot = path.join(__dirname, '..');
  }

  return {
    detModelPath: path.join(packageRoot, 'models/exported_det/inference.onnx'),
    recModelPath: path.join(packageRoot, 'models/exported_rec/inference.onnx'),
    characterDictPath: path.join(packageRoot, 'models/character_dict.json')
  };
}

