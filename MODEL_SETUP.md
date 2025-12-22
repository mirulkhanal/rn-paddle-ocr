# Model Setup Guide

This guide walks you through the manual steps required to prepare PaddleOCR models for this package.

## Prerequisites

1. Python 3.8 or higher installed
2. pip package manager

## Step 1: Install Required Python Packages

```bash
pip install paddleocr paddle2onnx
```

## Step 2: Download PaddleOCR Models

You need to download the following pre-trained models:

1. **Text Detection Model** - `ch_PP-OCRv4_det`
2. **Text Recognition Model** - `ch_PP-OCRv4_rec`
3. **Angle Classification Model** - `ch_ppocr_mobile_v2.0_cls`

### Option A: Download via Python Script

Create a temporary script `download_models.py`:

```python
from paddleocr import PaddleOCR

# This will download the models automatically
ocr = PaddleOCR(use_angle_cls=True, lang='ch', use_gpu=False)
```

Run it once to download models:

```bash
python download_models.py
```

Models will be downloaded to: `~/.paddleocr/`

### Option B: Manual Download

Download models from:
- Detection: https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese/ch_PP-OCRv4_det_infer.tar
- Recognition: https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese/ch_PP-OCRv4_rec_infer.tar
- CLS: https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar

Extract each tar file.

## Step 3: Convert Models to ONNX Format

For each model directory, run the conversion command:

### Detection Model Conversion

```bash
paddle2onnx \
  --model_dir ./ch_PP-OCRv4_det_infer \
  --model_filename inference.pdmodel \
  --params_filename inference.pdiparams \
  --save_file ./det.onnx \
  --opset_version 11
```

### Recognition Model Conversion

```bash
paddle2onnx \
  --model_dir ./ch_PP-OCRv4_rec_infer \
  --model_filename inference.pdmodel \
  --params_filename inference.pdiparams \
  --save_file ./rec.onnx \
  --opset_version 11
```

### CLS Model Conversion

```bash
paddle2onnx \
  --model_dir ./ch_ppocr_mobile_v2.0_cls_infer \
  --model_filename inference.pdmodel \
  --params_filename inference.pdiparams \
  --save_file ./cls.onnx \
  --opset_version 11
```

## Step 4: Place Models in Project Directories

After conversion, copy the `.onnx` files to the following locations:

### Android

```bash
mkdir -p android/src/main/assets/models
cp det.onnx android/src/main/assets/models/
cp rec.onnx android/src/main/assets/models/
cp cls.onnx android/src/main/assets/models/
```

### iOS

```bash
mkdir -p ios/Models
cp det.onnx ios/Models/
cp rec.onnx ios/Models/
cp cls.onnx ios/Models/
```

## Step 5: Verify Model Files

Ensure the following files exist:

```
android/src/main/assets/models/det.onnx
android/src/main/assets/models/rec.onnx
android/src/main/assets/models/cls.onnx

ios/Models/det.onnx
ios/Models/rec.onnx
ios/Models/cls.onnx
```

## Notes

- Model files are large (typically 10-50MB each)
- The package size will increase significantly with bundled models
- Consider model quantization if package size is a concern
- Models will be loaded into memory at runtime, so monitor memory usage

## Troubleshooting

If conversion fails:
- Ensure paddle2onnx is the latest version: `pip install --upgrade paddle2onnx`
- Check that model files are complete and not corrupted
- Verify ONNX opset version compatibility (version 11 is recommended for mobile)

