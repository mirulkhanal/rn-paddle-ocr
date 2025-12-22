# DB Postprocessing Reference Implementation

This directory contains a Python reference implementation of DB (Differentiable Binarization) postprocessing for PP-OCRv5_mobile_det ONNX model output.

## Overview

The detection ONNX model outputs a probability map `[1, 1, H, W]` representing the likelihood of text at each pixel. DB postprocessing converts this probability map into polygon bounding boxes that accurately represent text regions, including curved and rotated text.

## Files

- **`db_postprocess.py`**: Core DB postprocessing implementation
- **`test_db_postprocess.py`**: Unit tests for validation
- **`visualize.py`**: Visualization tool for debugging
- **`README.md`**: This file

## Algorithm

The DB postprocessing pipeline consists of the following steps:

### 1. Thresholding
```python
binary = prob_map > thresh  # Default: 0.3
```
Convert probability map to binary mask.

### 2. Connected Components
Find all connected regions in the binary map using OpenCV's `findContours()`.

### 3. Filtering
For each connected component:
- Skip if area < `min_area` (default: 300 pixels)
- Calculate mean score from probability map within the component
- Skip if mean score < `box_thresh` (default: 0.6)

### 4. Contour Extraction
Extract polygon from contour using `approxPolyDP()` for simplification.

### 5. Unclip Expansion
Expand polygon outward to better cover text boundaries:
```
distance = area * unclip_ratio / perimeter
```
Uses `pyclipper` library to offset polygon by computed distance.

### 6. Scaling
Scale polygon coordinates from resized image space back to original image space:
```python
# PP-OCR uses a single scale factor (preserves aspect ratio)
# Inverse transform: orig_coord = resized_coord / scale
polygon[:, 0] /= scale
polygon[:, 1] /= scale
```
Where `scale = resize_long / max(orig_h, orig_w)`.

**Important**: PP-OCR preserves aspect ratio, so coordinates map directly back using inverse scale. The same rectangle coordinates in original space will be recovered after inverse mapping (within rounding/unclip margins).

### 7. Clipping
Clip polygon coordinates to image bounds to ensure valid coordinates.

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `thresh` | 0.3 | Threshold for binarization |
| `box_thresh` | 0.6 | Minimum score threshold for boxes |
| `unclip_ratio` | 1.5 | Polygon expansion ratio |
| `max_candidates` | 1000 | Maximum number of boxes to return |
| `min_area` | 300 | Minimum component area in pixels |

These values are extracted from `inference.yml`:
```yaml
PostProcess:
  name: DBPostProcess
  thresh: 0.3
  box_thresh: 0.6
  max_candidates: 1000
  unclip_ratio: 1.5
```

## Usage

### Running Tests

```bash
# Activate conda environment first
conda activate onnx-runtime-config

cd python_reference
python test_db_postprocess.py
```

This will run all unit tests to validate the implementation.

### Visualization

```bash
python visualize.py \
  --image path/to/image.jpg \
  --model path/to/det.onnx \
  --output debug_db_output.jpg \
  --thresh 0.3 \
  --box_thresh 0.6 \
  --unclip_ratio 1.5
```

This will:
1. Load the input image
2. Run ONNX inference to get probability map
3. Apply DB postprocessing
4. Draw detected polygons on the image
5. Save the visualization

## Dependencies

```bash
pip install numpy opencv-python onnxruntime pyclipper
```

- **numpy**: Array operations
- **opencv-python**: Image processing, contour detection
- **onnxruntime**: ONNX model inference (for visualization)
- **pyclipper**: Polygon expansion (unclip)

## Validation

The implementation is considered correct when:

1. ✅ All unit tests pass
2. ✅ Detected boxes visually match PaddleOCR CLI output
3. ✅ Curved and rotated text is preserved
4. ✅ No boxes collapse or explode
5. ✅ Output polygons align with text boundaries

Compare visualization output with PaddleOCR CLI:
```bash
paddleocr --image=image.jpg --det=true --rec=false --cls=false
```

## Coordinate System

### Preprocessing (DetResizeForTest)

1. Compute scale: `scale = resize_long / max(orig_h, orig_w)`
2. Resize: `resize_h = round(orig_h * scale)`, `resize_w = round(orig_w * scale)`
3. Pad to model input size if needed (handled in preprocessing)

### Postprocessing (Inverse Transform)

1. Probability map corresponds to resized image dimensions `(resize_h, resize_w)`
2. Scale coordinates: `orig_coord = resized_coord / scale`
3. Clip to original image bounds: `0 ≤ x ≤ orig_w`, `0 ≤ y ≤ orig_h`

**Important**: PP-OCR uses a **single scale factor** that preserves aspect ratio. Never use separate `scale_x` and `scale_y`.

## Porting to Android/iOS

When porting this implementation to native code:

### Key Requirements

1. **Identical Math**: Use exact same formulas and calculations
2. **Identical Parameters**: Use same default values from config
3. **Identical Algorithm**: Follow same step-by-step process
4. **No Optimizations**: First get correctness, then optimize

### Android (Kotlin)

- Use OpenCV for Android for contour detection
- Use a Java/Kotlin port of pyclipper or implement unclip manually
- Convert numpy arrays to native arrays

### iOS (Swift)

- Use OpenCV for iOS for contour detection
- Use a Swift port of pyclipper or implement unclip manually
- Convert numpy arrays to Swift arrays

### Critical Functions to Port

1. **`db_postprocess()`**: Main postprocessing function
2. **`unclip()`**: Polygon expansion (most complex part)
3. **`is_clockwise()`**: Polygon orientation check
4. **`sigmoid()`**: Logit to probability conversion

### Testing Strategy

1. Run Python implementation on test images
2. Save expected polygon outputs (JSON format)
3. Port to native code
4. Compare native output with Python output
5. Pixel-perfect match required

## Implementation Notes

### Unclip Algorithm

The unclip expansion is the most critical part. The algorithm:

1. Calculates expansion distance: `distance = area * unclip_ratio / perimeter`
2. Uses pyclipper to offset polygon outward
3. Selects largest resulting polygon if multiple exist
4. Handles edge cases (expansion fails, no result)

### Polygon Format

- Each polygon is `[N, 2]` numpy array
- Coordinates are `(x, y)` pairs
- Vertices are in clockwise order
- Coordinates are in original image space

### Performance Considerations

For production use:
- Optimize contour simplification (epsilon parameter)
- Consider parallel processing for multiple images
- Cache pyclipper objects if processing batches
- Profile and optimize hot paths

## Troubleshooting

### No Detections

- Check threshold values (may be too strict)
- Verify probability map range (should be [0, 1] after sigmoid)
- Check image preprocessing matches model training

### Incorrect Box Sizes

- Verify scaling calculation
- Check source and destination shapes
- Ensure coordinates are clipped to bounds

### Unclip Failures

- Check polygon validity (minimum 3 points)
- Verify area and perimeter calculations
- Handle exceptions gracefully (skip polygon)

## References

- PaddleOCR DBPostProcess implementation
- DB Paper: "Real-time Scene Text Detection with Differentiable Binarization"
- pyclipper documentation: https://github.com/greginvm/pyclipper

