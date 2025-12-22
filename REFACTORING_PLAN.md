# OCR Refactoring Plan - PP-OCRv5 ONNX Best Practices

## Summary of Changes

This document outlines the comprehensive refactoring to align with PP-OCRv5 ONNX best practices.

## Completed Steps

1. ✅ Extracted character dictionary from `inference.yml` → `character_dict.json` (18,383 chars)
2. ✅ Created config.json files with preprocessing parameters from inference.yml
3. ✅ Removed old hardcoded `ppocr_keys_v1.txt` files

## Remaining Steps

### 1. Android Module Refactor

**File**: `android/src/main/java/com/receiptscanner/OcrReceiptScannerModule.kt`

**Changes**:
- Remove CLS model completely (no orientation correction)
- Load dictionary from `character_dict.json` (not hardcoded)
- Use preprocessing values from config.json:
  - Detection: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225], resize_long=960
  - Recognition: height=48, dynamic width, same mean/std
- Implement proper DB postprocessing for detection
- Simplify API to return: `{ text: string, boxes: Box[], confidence: number }`
- Remove receipt field extraction (simplify to basic OCR)

### 2. iOS Module Refactor

**File**: `ios/OcrReceiptScannerModule.swift`

**Mirror Android changes**:
- Same preprocessing values
- Same dictionary loading
- Same simplified API

### 3. TypeScript API Refactor

**File**: `src/OcrReceiptScanner.ts`

**Changes**:
- Update return type to simple OCR result (text + boxes + confidence)
- Remove receipt-specific extraction logic
- Simplify to basic OCR pipeline

### 4. Remove Receipt Extraction Logic

- Remove all multilingual field extraction code
- Keep only basic OCR functionality
- Users can do extraction on their side if needed

### 5. Update Documentation

- Update README to reflect simplified API
- Remove receipt-specific examples
- Document PP-OCRv5_mobile models only

## Configuration Values from inference.yml

### Detection Model (`exported_det/inference.yml`)
```yaml
PreProcess:
  - DecodeImage:
      img_mode: BGR
  - DetResizeForTest:
      resize_long: 960
  - NormalizeImage:
      mean: [0.485, 0.456, 0.406]
      std: [0.229, 0.224, 0.225]
      scale: 1./255.
  - ToCHWImage: null
PostProcess:
  name: DBPostProcess
  thresh: 0.3
  box_thresh: 0.6
  max_candidates: 1000
  unclip_ratio: 1.5
```

### Recognition Model (`exported_rec/inference.yml`)
```yaml
PreProcess:
  - DecodeImage:
      img_mode: BGR
  - RecResizeImg:
      image_shape: [3, 48, 320]
PostProcess:
  name: CTCLabelDecode
  character_dict: [18,383 characters]
```

## Dictionary Handling

- **Source**: `inference.yml` → `PostProcess.character_dict`
- **Format**: JSON array, first character is blank token (U+3000)
- **Size**: 18,383 characters
- **Loading**: Load from `character_dict.json` at runtime
- **Index Mapping**: Index i in dictionary = model output class i

## CTC Decoding Rules

1. Greedy selection: argmax at each timestep
2. Skip blank: index 0 (first character in dictionary)
3. Collapse repeats: skip if same as previous index
4. **Critical**: Don't update prevIndex when encountering blank

## Model Files

- ✅ `exported_det/inference.onnx` - Detection model
- ✅ `exported_rec/inference.onnx` - Recognition model
- ❌ Remove CLS model references

## API Design

### Before (Receipt-specific)
```typescript
scanReceipt(image): ReceiptData {
  receiptNumber, totalItems, grossAmount, netAmount, date, time, shopName
}
```

### After (Generic OCR)
```typescript
scan(image): OcrResult {
  text: string,
  boxes: Box[],
  confidence: number
}
```

