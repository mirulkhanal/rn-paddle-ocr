# OCR Refactoring Status

## Summary

This document tracks the progress of refactoring the OCR implementation to align with PP-OCRv5 ONNX best practices.

## Completed Changes ✅

### 1. Dictionary Handling
- ✅ Extracted character dictionary from `inference.yml` → `character_dict.json` (18,383 characters)
- ✅ Updated dictionary loading to use JSON file instead of hardcoded text file
- ✅ Removed `ppocr_keys_v1.txt` files (Android and iOS)
- ✅ Updated `loadCharacterDictionaryFromJson()` to load from JSON with proper error handling

### 2. Configuration Values
- ✅ Updated preprocessing constants to match `inference.yml`:
  - Detection: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
  - Recognition: same normalization values
- ✅ Updated model paths to use `exported_det` and `exported_rec` directories
- ✅ Created config.json files with preprocessing parameters

### 3. Model References
- ✅ Removed CLS model constant and session references
- ✅ Removed `correctImageOrientation()` function
- ✅ Removed `preprocessImageForCls()` function
- ✅ Updated comments to reflect PP-OCRv5_mobile models only

### 4. Preprocessing Updates
- ✅ Updated `preprocessImageForDetection()` to:
  - Use correct mean/std values from inference.yml
  - Implement proper aspect ratio handling (resize_long=960)
  - Use BGR format (correct extraction from ARGB Bitmap)
  - Convert to CHW format correctly
- ✅ Updated `preprocessImageForRecognition()` to:
  - Use correct mean/std values
  - Resize height to 48, maintain aspect ratio
  - Support dynamic width
  - Use BGR format

## Remaining Work ⚠️

### 1. API Simplification (CRITICAL)
- ❌ Update `scanReceipt()` method signature and return type
- ❌ Remove receipt field extraction logic (`extractReceiptFields()` and all related functions)
- ❌ Simplify return type to: `{ text: string, boxes: Box[], confidence: number }`
- ❌ Update data structures (remove ReceiptData, create OcrResult)

### 2. Code Cleanup
- ❌ Remove all receipt-specific extraction functions:
  - `extractReceiptNumber()`
  - `extractShopName()`
  - `extractGrossAmount()`
  - `extractNetAmount()`
  - `extractDate()`
  - `extractTime()`
  - `extractTotalItems()`
  - `extractReceiptFields()`
- ❌ Remove unused data classes (ReceiptData)
- ❌ Update `createReceiptDataMap()` to create simple OCR result map

### 3. Postprocessing
- ❌ Implement proper DB (Differentiable Binarization) postprocessing for detection
- ❌ Fix CTC decoding to handle model output shape correctly ([1, T, C] → [T, C])

### 4. TypeScript Layer
- ❌ Update `OcrReceiptScanner.ts` to match new simplified API
- ❌ Update `ReceiptData.interface.ts` to `OcrResult.interface.ts`
- ❌ Remove receipt-specific type definitions

### 5. iOS Implementation
- ❌ Mirror all Android changes to iOS module
- ❌ Update Swift code to match refactored Android implementation

### 6. Documentation
- ❌ Update README to reflect simplified API
- ❌ Remove receipt-specific examples
- ❌ Document PP-OCRv5_mobile models only

## Current Code Issues

1. **Function Signature Mismatch**: `processReceiptImage()` still returns `ReceiptData`, should return `OcrResult`
2. **Missing Data Structures**: `OcrResult`, `Box` types not defined
3. **Incomplete Preprocessing**: Detection preprocessing needs testing for aspect ratio handling
4. **Missing Postprocessing**: DB postprocessing is placeholder only
5. **Compilation Errors**: References to removed constants (MEAN, STD) and functions

## Next Steps

1. **Fix compilation errors** - Update all references to old constants
2. **Simplify API** - Change scanReceipt to return simple OCR result
3. **Remove receipt extraction** - Delete all field extraction logic
4. **Fix postprocessing** - Implement proper DB postprocessing
5. **Test and verify** - Ensure preprocessing matches inference.yml exactly

## Configuration Values (Source: inference.yml)

### Detection Model
```yaml
PreProcess:
  - DetResizeForTest:
      resize_long: 960
  - NormalizeImage:
      mean: [0.485, 0.456, 0.406]
      std: [0.229, 0.224, 0.225]
      scale: 1./255.
```

### Recognition Model
```yaml
PreProcess:
  - RecResizeImg:
      image_shape: [3, 48, 320]
PostProcess:
  name: CTCLabelDecode
  character_dict: [18,383 characters]
```

## Files Modified

- ✅ `android/src/main/java/com/receiptscanner/OcrReceiptScannerModule.kt` (partial)
- ✅ `android/src/main/assets/models/character_dict.json` (created)
- ✅ `android/src/main/assets/models/exported_det/config.json` (created)
- ✅ `android/src/main/assets/models/exported_rec/config.json` (created)
- ❌ `ios/OcrReceiptScannerModule.swift` (not started)
- ❌ `src/OcrReceiptScanner.ts` (not started)
- ❌ `src/types/ReceiptData.interface.ts` (needs replacement)

