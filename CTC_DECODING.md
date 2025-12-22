# CTC Decoding Implementation Guide

This document explains how CTC (Connectionist Temporal Classification) decoding is implemented in this package for converting recognition model outputs to text.

## Overview

The recognition ONNX model outputs a sequence of probability vectors over a fixed character dictionary, NOT text directly. CTC decoding is required to convert these probability distributions into readable text.

## CTC Decoding Rules

The decoding algorithm follows three simple rules:

1. **Greedy Selection**: At each timestep, take the character index with the maximum probability (argmax)
2. **Remove Blanks**: Skip index 0 (BLANK token) - it should never appear in the output
3. **Collapse Repeats**: Skip if the current index is the same as the previous timestep's index

## Character Dictionary

The character dictionary is stored in:
- **Android**: `android/src/main/assets/ppocr_keys_v1.txt`
- **iOS**: `ios/ppocr_keys_v1.txt` (needs to be added to Xcode project)

### Dictionary Format

- One character per line
- Index 0 is always the BLANK token (empty string or special marker)
- Indices 1+ are actual characters (numbers, letters, Chinese characters, punctuation, etc.)

### Example Dictionary Structure

```
        ← Index 0: BLANK (empty line)
0        ← Index 1
1        ← Index 2
2        ← Index 3
...
A        ← Index 36
B        ← Index 37
...
一        ← Chinese character at some index
二        ← Another Chinese character
...
```

## Implementation Details

### Android (Kotlin)

The CTC decoding is implemented in `OcrReceiptScannerModule.kt`:

```kotlin
private fun decodeRecognitionOutput(output: Array<FloatArray>): String {
    val numTimesteps = output.size
    val numClasses = output[0].size
    
    val result = StringBuilder()
    var prevIndex = -1
    
    for (t in 0 until numTimesteps) {
        // Rule 1: Greedy selection
        var maxIndex = 0
        var maxValue = output[t][0]
        for (c in 1 until numClasses) {
            if (output[t][c] > maxValue) {
                maxValue = output[t][c]
                maxIndex = c
            }
        }
        
        // Rule 2: Skip blank - do NOT update prevIndex here
        // This allows repeated characters separated by blanks to be correctly decoded
        if (maxIndex == 0) continue
        
        // Rule 3: Collapse repeats
        if (maxIndex == prevIndex) continue
        
        // Append character
        result.append(charDict[maxIndex])
        // Only update prevIndex after successfully appending a character
        prevIndex = maxIndex
    }
    
    return result.toString()
}
```

**Important Note**: When encountering a blank token (index 0), we skip it without updating `prevIndex`. This ensures that repeated characters separated by blanks are correctly decoded. Only update `prevIndex` after successfully appending a character.

### iOS (Swift)

The CTC decoding is implemented in `OcrReceiptScannerModule.swift`:

```swift
private func performCTCDecoding(logits: [[Float]], numTimesteps: Int, numClasses: Int) -> String {
    var result = ""
    var prevIndex = -1
    
    for t in 0..<numTimesteps {
        // Rule 1: Greedy selection
        var maxIndex = 0
        var maxValue = logits[t][0]
        for c in 1..<numClasses {
            if logits[t][c] > maxValue {
                maxValue = logits[t][c]
                maxIndex = c
            }
        }
        
        // Rule 2: Skip blank - do NOT update prevIndex here
        // This allows repeated characters separated by blanks to be correctly decoded
        if maxIndex == 0 {
            continue
        }
        
        // Rule 3: Collapse repeats
        if maxIndex == prevIndex {
            continue
        }
        
        // Append character
        result.append(charDict[maxIndex])
        // Only update prevIndex after successfully appending a character
        prevIndex = maxIndex
    }
    
    return result
}
```

**Important Note**: When encountering a blank token (index 0), we skip it without updating `prevIndex`. This ensures that repeated characters separated by blanks are correctly decoded. Only update `prevIndex` after successfully appending a character.

## Model Output Format

The recognition ONNX model outputs a tensor with shape `[1, T, C]`:

- **1**: Batch size (always 1 for single image inference)
- **T**: Number of timesteps (typically 25-100, depending on resized image width)
- **C**: Number of character classes = `len(ppocr_keys_v1.txt) + 1`
  - Index 0 = CTC blank token
  - Indices 1+ = actual characters from dictionary

Each element `output[t][c]` represents the logit (not probability) that character class `c` appears at timestep `t`.

**Important**: 
- The model outputs **logits**, not probabilities
- No softmax is required
- `argmax(logits)` is sufficient for greedy decoding

## Decoding Example

Let's trace through a simple example:

### Input (simplified, 5-character alphabet)
- Dictionary: `["", "H", "E", "L", "O"]` (index 0 is BLANK)

### Model Output (argmax per timestep)
```
Timestep 0: [0.9, 0.1, 0.0, 0.0, 0.0] → index 0 (BLANK) → skip
Timestep 1: [0.1, 0.9, 0.0, 0.0, 0.0] → index 1 ("H") → append "H"
Timestep 2: [0.1, 0.8, 0.1, 0.0, 0.0] → index 1 ("H") → skip (repeat)
Timestep 3: [0.2, 0.1, 0.7, 0.0, 0.0] → index 2 ("E") → append "E"
Timestep 4: [0.1, 0.0, 0.2, 0.7, 0.0] → index 3 ("L") → append "L"
Timestep 5: [0.1, 0.0, 0.0, 0.8, 0.1] → index 3 ("L") → skip (repeat)
Timestep 6: [0.1, 0.0, 0.0, 0.1, 0.8] → index 4 ("O") → append "O"
```

### Result
```
"HELLO"
```

## Loading the Dictionary

The dictionary is loaded automatically when models are initialized:

1. **Android**: Loaded from assets using `AssetManager`
2. **iOS**: Loaded from bundle resources

If the dictionary file is not found, a default dictionary is created with:
- Numbers (0-9)
- Letters (A-Z, a-z)
- Common punctuation
- Common Chinese punctuation

## Notes

- **No softmax needed**: The argmax operation is invariant to softmax, so raw logits can be used directly. The model outputs logits, not probabilities.
- **Performance**: CTC decoding is very fast (~microseconds) and suitable for mobile
- **Accuracy**: Greedy decoding (argmax) is used instead of beam search for simplicity and speed
- **Dictionary size**: For PaddleOCR models, the dictionary typically contains 6600+ characters including Chinese, English, numbers, and punctuation
- **Blank handling**: When encountering a blank token (index 0), skip it without updating `prevIndex`. This allows repeated characters separated by blanks to be correctly decoded.
- **Model output shape**: The recognition model outputs `[1, T, C]` where C = dictionary_size + 1 (includes blank token)

## Troubleshooting

### Empty Output
- Check that character dictionary is loaded correctly
- Verify dictionary size matches model output classes (C dimension should be dictionary_size + 1)
- Ensure model output tensor is properly extracted (shape should be [1, T, C])

### Incorrect Characters
- Verify dictionary file matches the model's training dictionary (ppocr_keys_v1.txt for PP-OCRv5)
- Check dictionary file encoding (should be UTF-8)
- Ensure dictionary indices align with model outputs (index 0 = blank, indices 1+ = characters)

### Repeated Characters Missing
- Ensure blank tokens (index 0) don't update `prevIndex` - this is critical for correct decoding
- Verify the CTC decoding logic follows the three rules exactly

### Performance Issues
- CTC decoding itself is fast; bottlenecks are usually in model inference
- Consider optimizing tensor extraction if needed

