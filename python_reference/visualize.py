"""
Visualization helper for DB postprocessing output.

This script loads an image, runs ONNX inference, applies DB postprocessing,
and visualizes the detected polygons on the original image.
"""

import numpy as np
import cv2
import onnxruntime as ort
import sys
import os
import argparse

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_postprocess import db_postprocess, sigmoid, compute_det_resize_meta


def load_image(image_path):
    """Load image and convert to BGR format."""
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")
    return img


def preprocess_image(img, target_long_side=960):
    """
    Preprocess image for detection model (matches PP-OCR DetResizeForTest).
    
    Args:
        img: numpy array [H, W, 3], BGR image
        target_long_side: int, target size for long side (default: 960)
    
    Returns:
        preprocessed: numpy array [1, 3, H, W], normalized image (with padding if needed)
        resize_h: int, resized height (before padding)
        resize_w: int, resized width (before padding)
        scale: float, scale factor applied
        original_shape: tuple (H, W), original image shape
    """
    original_h, original_w = img.shape[:2]
    original_shape = (original_h, original_w)
    
    # Compute resize dimensions (preserves aspect ratio)
    resize_h, resize_w, scale = compute_det_resize_meta(original_h, original_w, target_long_side)
    
    # Resize image
    resized = cv2.resize(img, (resize_w, resize_h), interpolation=cv2.INTER_LINEAR)
    
    # Normalize: (pixel / 255.0 - mean) / std
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    # Convert BGR to RGB and normalize
    img_rgb = resized[:, :, ::-1].astype(np.float32) / 255.0
    img_normalized = (img_rgb - mean) / std
    
    # Note: Model may require padding to specific input size, but for postprocessing
    # we only care about the resized dimensions (resize_h, resize_w)
    
    # Convert to CHW format
    img_chw = img_normalized.transpose(2, 0, 1)  # [3, H, W]
    
    # Add batch dimension
    preprocessed = np.expand_dims(img_chw, axis=0)  # [1, 3, H, W]
    
    return preprocessed.astype(np.float32), resize_h, resize_w, scale, original_shape


def run_onnx_inference(model_path, input_tensor, resize_h, resize_w):
    """
    Run ONNX inference on detection model.
    
    Args:
        model_path: str, path to ONNX model
        input_tensor: numpy array [1, 3, H, W], preprocessed image (may be padded)
        resize_h: int, actual resized height (before padding)
        resize_w: int, actual resized width (before padding)
    
    Returns:
        numpy array [resize_h, resize_w], probability map (cropped to resize dimensions)
    """
    # Create ONNX Runtime session
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    
    # Get input/output names
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    # Run inference
    outputs = session.run([output_name], {input_name: input_tensor})
    
    # Output shape is [1, 1, H, W] where H, W may include padding
    prob_map_full = outputs[0][0, 0, :, :]  # Remove batch and channel dimensions
    
    # Apply sigmoid to convert logits to probabilities
    prob_map_full = sigmoid(prob_map_full)
    
    # Crop to actual resized dimensions (remove padding)
    prob_map = prob_map_full[:resize_h, :resize_w]
    
    return prob_map


def draw_polygons(img, polygons, color=(0, 255, 0), thickness=2):
    """
    Draw polygons on image.
    
    Args:
        img: numpy array [H, W, 3], image to draw on
        polygons: List[np.ndarray], list of polygons
        color: tuple (B, G, R), polygon color
        thickness: int, line thickness
    
    Returns:
        numpy array, image with polygons drawn
    """
    img_copy = img.copy()
    
    for polygon in polygons:
        # Convert to integer coordinates
        pts = polygon.astype(np.int32)
        
        # Draw polygon outline
        cv2.polylines(img_copy, [pts], isClosed=True, color=color, thickness=thickness)
        
        # Optionally fill polygon with transparency
        # overlay = img_copy.copy()
        # cv2.fillPoly(overlay, [pts], color)
        # cv2.addWeighted(overlay, 0.3, img_copy, 0.7, 0, img_copy)
    
    return img_copy


def visualize_db_output(image_path, model_path, output_path="debug_db_output.jpg",
                       thresh=0.3, box_thresh=0.6, unclip_ratio=1.5):
    """
    Main visualization function.
    
    Args:
        image_path: str, path to input image
        model_path: str, path to ONNX model
        output_path: str, path to save output image
        thresh: float, binarization threshold
        box_thresh: float, box score threshold
        unclip_ratio: float, polygon expansion ratio
    """
    print(f"Loading image: {image_path}")
    img = load_image(image_path)
    
    print("Preprocessing image...")
    input_tensor, resize_h, resize_w, scale, orig_shape = preprocess_image(img)
    print(f"  Original shape: {orig_shape}")
    print(f"  Resized shape: ({resize_h}, {resize_w})")
    print(f"  Scale factor: {scale:.4f}")
    
    print(f"Running ONNX inference on model: {model_path}")
    prob_map = run_onnx_inference(model_path, input_tensor, resize_h, resize_w)
    print(f"Probability map shape: {prob_map.shape}")
    print(f"Probability map range: [{prob_map.min():.3f}, {prob_map.max():.3f}]")
    
    print("Applying DB postprocessing...")
    polygons = db_postprocess(
        prob_map,
        orig_shape=orig_shape,
        resize_shape=(resize_h, resize_w),
        scale=scale,
        thresh=thresh,
        box_thresh=box_thresh,
        unclip_ratio=unclip_ratio
    )
    
    print(f"Detected {len(polygons)} text regions")
    
    # Draw polygons on image
    print("Drawing polygons...")
    img_with_polygons = draw_polygons(img, polygons)
    
    # Save output
    cv2.imwrite(output_path, img_with_polygons)
    print(f"Saved visualization to: {output_path}")
    
    # Print polygon statistics
    if len(polygons) > 0:
        print("\nPolygon statistics:")
        for i, poly in enumerate(polygons[:5]):  # Show first 5
            x_min, y_min = poly.min(axis=0)
            x_max, y_max = poly.max(axis=0)
            print(f"  Polygon {i+1}: {len(poly)} points, "
                  f"bounds: x=[{x_min:.1f}, {x_max:.1f}], y=[{y_min:.1f}, {y_max:.1f}]")
        if len(polygons) > 5:
            print(f"  ... and {len(polygons) - 5} more")
    
    return img_with_polygons, polygons


def main():
    parser = argparse.ArgumentParser(description="Visualize DB postprocessing output")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--model", required=True, help="Path to ONNX detection model")
    parser.add_argument("--output", default="debug_db_output.jpg", help="Output image path")
    parser.add_argument("--thresh", type=float, default=0.3, help="Binarization threshold")
    parser.add_argument("--box_thresh", type=float, default=0.6, help="Box score threshold")
    parser.add_argument("--unclip_ratio", type=float, default=1.5, help="Unclip expansion ratio")
    
    args = parser.parse_args()
    
    try:
        visualize_db_output(
            args.image,
            args.model,
            args.output,
            args.thresh,
            args.box_thresh,
            args.unclip_ratio
        )
        print("\n✓ Visualization complete!")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

