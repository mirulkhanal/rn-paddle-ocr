# ReceiptOCR vs Ocr - Purpose and Differences

## Overview

This package provides two ways to use OCR functionality:
1. **`ReceiptOCR`** - Low-level class-based API (manual control)
2. **`Ocr`** - High-level singleton API (convenience wrapper)

## ReceiptOCR Class (`src/ReceiptOCR.ts`)

### Purpose
Core OCR implementation class that handles all OCR operations. Provides fine-grained control over the OCR lifecycle.

### Characteristics
- **Class-based**: Instantiate multiple instances if needed
- **Manual initialization**: You must explicitly call:
  - `loadModel()` - Load detection model
  - `loadRecognitionModel()` - Load recognition model  
  - `loadCharacterDict()` or `loadCharacterDictFromArray()` - Load character dictionary
- **Direct control**: Full control over when models are loaded and how instances are managed
- **No automatic resolution**: Requires explicit model paths/arrays

### Use Cases
- When you need multiple OCR instances
- When you want fine-grained control over model loading
- When building custom wrappers or advanced use cases
- When you don't want singleton behavior

### Example Usage
```typescript
import { ReceiptOCR } from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

const ocr = new ReceiptOCR({
  readAsStringAsync: FileSystem.readAsStringAsync.bind(FileSystem)
});

await ocr.loadModel(require('./models/det.onnx'));
await ocr.loadRecognitionModel(require('./models/rec.onnx'));
await ocr.loadCharacterDictFromArray(require('./models/dict.json'));

const results = await ocr.processAndRecognize('data:image/jpeg;base64,...');
```

## Ocr Singleton (`src/Ocr.ts`)

### Purpose
Convenience wrapper around `ReceiptOCR` that provides a simpler, singleton-based API. Designed for most common use cases.

### Characteristics
- **Singleton pattern**: Single global instance managed internally
- **Automatic initialization**: Models are loaded automatically on first use
- **Simplified API**: Only two methods:
  - `init(config)` - Initialize with config (optional if config provided to scan)
  - `scan(imagePath, config?)` - Scan image (can initialize on-the-fly)
- **Previously had automatic model resolution**: Used `modelResolver` to find bundled models (being removed)

### Use Cases
- Most common use cases (90% of users)
- When you want a simple, straightforward API
- When you only need one OCR instance
- When you want automatic initialization

### Example Usage
```typescript
import Ocr from '@mirulkhanall/rn-paddle-ocr';
import * as FileSystem from 'expo-file-system';

await Ocr.init({
  detModelPath: require('./models/det.onnx'),
  recModelPath: require('./models/rec.onnx'),
  characterDict: require('./models/dict.json'),
  fileSystemAdapter: {
    readAsStringAsync: FileSystem.readAsStringAsync.bind(FileSystem)
  }
});

const results = await Ocr.scan('data:image/jpeg;base64,...');
```

## Key Differences

| Feature | ReceiptOCR | Ocr |
|---------|-----------|-----|
| **Pattern** | Class (multiple instances) | Singleton (single instance) |
| **Initialization** | Manual (3 separate calls) | Automatic (1 call or on scan) |
| **Model Loading** | Explicit methods | Handled internally |
| **API Complexity** | More methods, more control | Fewer methods, simpler |
| **Use Case** | Advanced/custom scenarios | Standard use cases |
| **Flexibility** | High (multiple instances) | Low (single instance) |

## Similarities

Both classes:
- Use the same underlying OCR processing logic
- Support the same image formats (base64 data URI, file URI)
- Return the same `OcrResult[]` format
- Require the same model files (detection, recognition, character dict)
- Support the same `FileSystemAdapter` interface

## Recommendation

- **Use `Ocr`** for most applications (simpler, cleaner API)
- **Use `ReceiptOCR`** when you need:
  - Multiple OCR instances
  - Custom initialization logic
  - More control over the lifecycle
  - Integration into custom frameworks

