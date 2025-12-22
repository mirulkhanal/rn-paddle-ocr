# OCR Receipt Scanner

React Native package for OCR receipt scanning using PaddleOCR models with multilingual support (Simplified/Traditional Chinese, English).

## Installation

```bash
npm install @mirulkhanall/rn-paddle-ocr onnxruntime-react-native
```

## Usage

### Basic Usage with Expo FileSystem (Recommended)

**Option 1: Copy models to your app assets (Simplest - Recommended for Expo):**

Copy the model files from `node_modules/@mirulkhanall/rn-paddle-ocr/models/` to your app's assets folder (e.g., `assets/models/`), then:

```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

await Ocr.init({
  detModelPath: require('./assets/models/exported_det/inference.onnx'),
  recModelPath: require('./assets/models/exported_rec/inference.onnx'),
  characterDict: require('./assets/models/character_dict.json'),
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

**Option 2: Automatic resolution (requires Metro configuration):**

The package will attempt to automatically resolve bundled models when you provide `fileSystemAdapter`. However, this requires configuring Metro bundler to bundle `.onnx` files from `node_modules`. See [Metro Configuration](#metro-configuration) below.

```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

// Attempts automatic resolution (may require Metro config)
await Ocr.init({
  fileSystemAdapter: {
    readAsStringAsync: FileSystem.readAsStringAsync.bind(FileSystem)
  }
});
```

**Using custom model paths (optional):**

```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

// Provide your own model paths if needed
await Ocr.init({
  detModelPath: require('./assets/models/inference_det.onnx'),
  recModelPath: require('./assets/models/inference_rec.onnx'),
  characterDict: require('./assets/models/character_dict.json'),
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

## Metro Configuration (for Automatic Model Resolution)

To enable automatic model resolution without copying models to your app assets, you need to configure Metro bundler to bundle `.onnx` files from `node_modules`. 

Create or update `metro.config.js` in your project root:

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .onnx to asset extensions
config.resolver.assetExts.push('onnx');

// Optionally, configure source extensions if needed
// config.resolver.sourceExts.push('onnx');

module.exports = config;
```

**Note:** Even with Metro configuration, the recommended approach is to copy models to your app assets folder (Option 1 above) for better reliability and smaller bundle sizes (models are only included when explicitly required).

## Requirements

- React Native >= 0.70.0
- React >= 18.0.0
- `onnxruntime-react-native` package
- File system adapter (e.g., `expo-file-system` or `react-native-fs`) if using file URIs

## Models

Models are included in the package under `models/`. The recommended approach is to copy them to your app's assets folder:

1. **Copy models to app assets** (Recommended): Copy `models/` folder from `node_modules/@mirulkhanall/rn-paddle-ocr/models/` to your app's assets directory
2. **Use require()**: Reference models using `require()` statements after copying
3. **Configure Metro**: Set up Metro bundler to bundle `.onnx` files from `node_modules` (see Metro Configuration above)

## Platform Support

✅ **React Native** (iOS & Android)
✅ **Expo** (with file system adapter)

This package uses `onnxruntime-react-native` which supports both iOS and Android platforms.
