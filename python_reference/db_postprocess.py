"""
DB (Differentiable Binarization) Postprocessing for PP-OCRv5_mobile_det

This module implements DB postprocessing to convert probability maps from the detection
ONNX model into polygon bounding boxes for text regions.

Algorithm:
1. Apply threshold to create binary map
2. Find connected components
3. Filter components by area and score
4. Extract contours as polygons
5. Apply unclip expansion
6. Scale to original image size

Reference: PaddleOCR DBPostProcess implementation
"""

import numpy as np
import cv2
try:
    import pyclipper
except ImportError:
    raise ImportError("pyclipper is required. Install with: pip install pyclipper")


def compute_det_resize_meta(orig_h, orig_w, resize_long=960):
    """
    Compute resize metadata for PP-OCRv5 detection preprocessing.
    
    This matches DetResizeForTest behavior:
    1. Compute scale based on long side
    2. Resize preserving aspect ratio
    3. Pad to model input size (handled separately in preprocessing)
    
    Args:
        orig_h: int, original image height
        orig_w: int, original image width
        resize_long: int, target size for long side (default: 960)
    
    Returns:
        tuple: (resize_h, resize_w, scale)
    """
    scale = resize_long / max(orig_h, orig_w)
    resize_h = int(round(orig_h * scale))
    resize_w = int(round(orig_w * scale))
    return resize_h, resize_w, scale


def db_postprocess(prob_map, orig_shape, resize_shape, scale, thresh=0.3, box_thresh=0.6, 
                   unclip_ratio=1.5, max_candidates=1000, min_area=300):
    """
    Postprocess detection model probability map to extract text polygon boxes.
    
    This function assumes the probability map corresponds to the resized image (before padding).
    Coordinates are scaled back to original image space using the scale factor.
    
    Args:
        prob_map: numpy array [H, W], float32, probability map (after sigmoid)
                 This should match resize_shape dimensions
        orig_shape: tuple (orig_h, orig_w) - original image size
        resize_shape: tuple (resize_h, resize_w) - resized image size (before padding)
        scale: float, scale factor used in preprocessing (resize_long / max(orig_h, orig_w))
        thresh: float, threshold for binarization (default: 0.3)
        box_thresh: float, minimum score threshold for boxes (default: 0.6)
        unclip_ratio: float, expansion ratio for polygons (default: 1.5)
        max_candidates: int, maximum number of boxes to return (default: 1000)
        min_area: int, minimum component area in pixels (default: 300)
    
    Returns:
        List[np.ndarray]: List of polygons, each shape [N, 2] (x, y coordinates, clockwise)
                         Coordinates are in original image space
    """
    # Step 1: Apply threshold to create binary map
    binary = (prob_map > thresh).astype(np.uint8) * 255
    
    # Step 2: Find connected components
    # Use OpenCV's findContours (works with binary image)
    # RETR_EXTERNAL: only external contours
    # CHAIN_APPROX_SIMPLE: compress horizontal, vertical, and diagonal segments
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if len(contours) == 0:
        return []
    
    # Get original image dimensions for bounds clipping
    orig_h, orig_w = orig_shape
    
    polygons = []
    
    # Step 3: Process each contour
    for contour in contours:
        # Skip if contour is too small
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        
        # Compute mean score from probability map
        # Create mask for this contour
        mask = np.zeros(prob_map.shape, dtype=np.uint8)
        cv2.fillPoly(mask, [contour], 255)
        mask = mask > 0
        
        # Calculate mean probability within the contour
        mean_score = prob_map[mask].mean()
        
        # Skip if score is too low
        if mean_score < box_thresh:
            continue
        
        # Step 4: Extract polygon from contour
        # Simplify contour to reduce points (optional, but helps with unclip)
        epsilon = 0.005 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Convert to polygon format [N, 2]
        if len(approx) < 3:  # Need at least 3 points for a polygon
            continue
        
        polygon = approx.reshape(-1, 2).astype(np.float32)
        
        # Step 5: Apply unclip expansion
        try:
            expanded_polygon = unclip(polygon, unclip_ratio, area)
            if expanded_polygon is None or len(expanded_polygon) < 3:
                continue
            polygon = expanded_polygon
        except Exception as e:
            # If unclip fails, skip this polygon
            print(f"Unclip failed for polygon: {e}")
            continue
        
        # Step 6: Scale polygon from resized image space back to original image space
        # PP-OCR uses a single scale factor (preserves aspect ratio)
        # Inverse transform: orig_coord = resized_coord / scale
        polygon[:, 0] /= scale
        polygon[:, 1] /= scale
        
        # Step 7: Clip polygon coordinates to original image bounds
        polygon[:, 0] = np.clip(polygon[:, 0], 0, orig_w)
        polygon[:, 1] = np.clip(polygon[:, 1], 0, orig_h)
        
        # Ensure polygon is clockwise (required for consistency)
        if not is_clockwise(polygon):
            polygon = polygon[::-1]
        
        polygons.append(polygon.astype(np.float32))
        
        # Limit number of candidates
        if len(polygons) >= max_candidates:
            break
    
    return polygons


def unclip(polygon, unclip_ratio, area):
    """
    Expand polygon outward using unclip ratio.
    
    Args:
        polygon: np.ndarray [N, 2], polygon coordinates
        unclip_ratio: float, expansion ratio
        area: float, polygon area
    
    Returns:
        np.ndarray [M, 2]: expanded polygon, or None if expansion fails
    """
    try:
        # Calculate perimeter
        perimeter = cv2.arcLength(polygon, True)
        if perimeter < 1e-6:
            return None
        
        # Calculate expansion distance
        # distance = area * unclip_ratio / perimeter
        distance = area * unclip_ratio / perimeter
        
        # Convert polygon to pyclipper format (list of tuples)
        # pyclipper uses integer coordinates, so we scale up
        SCALE = 1000  # Scale factor for precision
        scaled_poly = [(int(x * SCALE), int(y * SCALE)) for x, y in polygon]
        
        # Create pyclipper object
        pc = pyclipper.PyclipperOffset()
        pc.AddPath(scaled_poly, pyclipper.JT_ROUND, pyclipper.ET_CLOSEDPOLYGON)
        
        # Expand polygon
        scaled_distance = int(distance * SCALE)
        expanded = pc.Execute(scaled_distance)
        
        if not expanded or len(expanded) == 0:
            return None
        
        # Select largest polygon if multiple results
        expanded_poly = max(expanded, key=lambda p: abs(pyclipper.Area(p)))
        
        # Convert back to float coordinates
        expanded_polygon = np.array(expanded_poly, dtype=np.float32) / SCALE
        
        return expanded_polygon
        
    except Exception as e:
        print(f"Unclip error: {e}")
        return None


def is_clockwise(polygon):
    """
    Check if polygon vertices are in clockwise order.
    
    Args:
        polygon: np.ndarray [N, 2], polygon coordinates
    
    Returns:
        bool: True if clockwise, False if counter-clockwise
    """
    # Use shoelace formula to determine orientation
    # Positive area = counter-clockwise, negative = clockwise
    x = polygon[:, 0]
    y = polygon[:, 1]
    area = np.sum((x[1:] - x[:-1]) * (y[1:] + y[:-1]))
    return area < 0


def sigmoid(x):
    """
    Apply sigmoid activation to convert logits to probabilities.
    
    Args:
        x: numpy array, logits
    
    Returns:
        numpy array, probabilities
    """
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

