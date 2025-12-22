# OCR Receipt Scanner

React Native package for OCR receipt scanning using PaddleOCR models with multilingual support (Simplified/Traditional Chinese, English).

## Installation

```bash
npm install @mirulkhanall/rn-paddle-ocr onnxruntime-react-native
```

## Usage

### Basic Usage with Expo FileSystem

```typescript
import Ocr, { getDefaultModelPaths } from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

// Initialize with bundled models
const modelPaths = getDefaultModelPaths();

await Ocr.init({
  detModelPath: modelPaths.detModelPath,
  recModelPath: modelPaths.recModelPath,
  characterDictPath: modelPaths.characterDictPath,
  fileSystemAdapter: {
    readAsStringAsync: FileSystem.readAsStringAsync.bind(FileSystem)
  }
});

// Scan an image (supports base64 data URI or file URI)
const results = await Ocr.scan('data:image/jpeg;base64,/9j/4AAQ...');

// Results contain detected text with bounding boxes and confidence scores
results.forEach(result => {
  console.log(`Text: ${result.text}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Box:`, result.box.points);
});
```

### Using Bundled Models with require()

```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

await Ocr.init({
  detModelPath: require('./node_modules/@mirulkhanall/rn-paddle-ocr/models/exported_det/inference.onnx'),
  recModelPath: require('./node_modules/@mirulkhanall/rn-paddle-ocr/models/exported_rec/inference.onnx'),
  characterDictPath: require('./node_modules/@mirulkhanall/rn-paddle-ocr/models/character_dict.json'),
  fileSystemAdapter: {
    readAsStringAsync: FileSystem.readAsStringAsync.bind(FileSystem)
  }
});
```

### Using React Native FS

```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import RNFS from 'react-native-fs';

await Ocr.init({
  detModelPath: `${RNFS.MainBundlePath}/models/inference_det.onnx`,
  recModelPath: `${RNFS.MainBundlePath}/models/inference_rec.onnx`,
  characterDictPath: `${RNFS.MainBundlePath}/models/character_dict.json`,
  fileSystemAdapter: {
    readAsStringAsync: async (uri: string, options: { encoding: 'utf8' | 'base64' }) => {
      return await RNFS.readFile(uri, options.encoding);
    }
  }
});
```

### Using Character Dictionary as Array (Recommended for require())

When using `require()` for models, use `characterDict` array for the dictionary (since `require()` for JSON returns the parsed object):

```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import characterDict from './assets/character_dict.json';

await Ocr.init({
  detModelPath: require('./models/inference_det.onnx'),
  recModelPath: require('./models/inference_rec.onnx'),
  characterDict: characterDict, // Use array when using require() for JSON
  fileSystemAdapter: fileSystemAdapter
});
```

### Scanning Images

Images can be provided as:
- **Base64 data URI**: `'data:image/jpeg;base64,/9j/4AAQ...'`
- **File URI** (with fileSystemAdapter): `'file:///path/to/image.jpg'`

```typescript
// Base64 (no file system adapter needed)
const results = await Ocr.scan('data:image/jpeg;base64,...');

// File URI (requires fileSystemAdapter)
const results = await Ocr.scan('file:///path/to/image.jpg');
```

## API

### `Ocr.init(config: OcrConfig): Promise<void>`

Initialize the OCR engine with model paths and character dictionary.

### `Ocr.scan(imagePath: string, config?: OcrConfig): Promise<OcrResult[]>`

Scan an image and return detected text results.

**Parameters:**
- `imagePath`: Base64 data URI (e.g., `'data:image/jpeg;base64,...'`) or file URI (requires `fileSystemAdapter`)
- `config`: Optional configuration (required if not initialized)

**Returns:**
Array of `OcrResult` objects containing:
- `box`: Bounding box with points and score
- `text`: Detected text string
- `confidence`: Confidence score (0-1)

### `getDefaultModelPaths(): { detModelPath: string, recModelPath: string, characterDictPath: string }`

Helper function to get paths to the bundled models included with the package. Note: In React Native, you may need to use `require()` or asset paths instead of file system paths.

## Types

```typescript
interface FileSystemAdapter {
  readAsStringAsync(uri: string, options: { encoding: 'utf8' | 'base64' }): Promise<string>;
}

interface OcrConfig {
  detModelPath: string | number;        // Path or require() result (number) for detection model
  recModelPath: string | number;        // Path or require() result (number) for recognition model
  characterDictPath?: string;           // File path to character dictionary JSON (use fileSystemAdapter)
  characterDict?: string[];             // Character dictionary as array (use this with require() for JSON)
  fileSystemAdapter?: FileSystemAdapter; // Required for file URI/characterDictPath access
}

interface OcrResult {
  box: {
    points: Point[];
    score: number;
  };
  text: string;
  confidence: number;
}
```

## Requirements

- React Native >= 0.70.0
- React >= 18.0.0
- `onnxruntime-react-native` package
- File system adapter (e.g., `expo-file-system` or `react-native-fs`) if using file URIs

## Models

Models are included in the package under `models/`. To use them in React Native:

1. **Bundle as assets**: Copy models to your app's assets and reference them
2. **Use require()**: Reference models using `require()` statements
3. **Download at runtime**: Download models on first use

## Platform Support

✅ **React Native** (iOS & Android)
✅ **Expo** (with file system adapter)

This package uses `onnxruntime-react-native` which supports both iOS and Android platforms.
