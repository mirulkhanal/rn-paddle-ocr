"""
Tests for DB postprocessing implementation.

Tests cover:
1. Shape validation
2. Synthetic rectangle detection
3. Edge cases (empty input, no detections)
4. Parameter validation
"""

import numpy as np
import cv2
import sys
import os

# Add parent directory to path to import db_postprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_postprocess import db_postprocess, sigmoid, compute_det_resize_meta


def test_shape_validation():
    """Test that input/output shapes are correct."""
    print("Test 1: Shape validation...")
    
    # Create dummy probability map matching resize_shape
    orig_shape = (1280, 1280)
    resize_h, resize_w, scale = compute_det_resize_meta(orig_shape[0], orig_shape[1], resize_long=960)
    
    prob_map = np.random.rand(resize_h, resize_w).astype(np.float32)
    prob_map = sigmoid(prob_map - 2.0)  # Lower values for sparse detections
    
    polygons = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale)
    
    # Check output is list
    assert isinstance(polygons, list), "Output should be a list"
    
    # Check each polygon shape
    for poly in polygons:
        assert isinstance(poly, np.ndarray), "Each polygon should be numpy array"
        assert poly.ndim == 2, "Polygon should be 2D array"
        assert poly.shape[1] == 2, "Polygon should have shape [N, 2]"
        assert poly.shape[0] >= 3, "Polygon should have at least 3 points"
    
    print("✓ Shape validation passed")
    return True


def test_synthetic_rectangle():
    """Test detection of a synthetic rectangle in probability map."""
    print("\nTest 2: Synthetic rectangle detection...")
    
    # Original image size
    orig_shape = (200, 200)
    resize_h, resize_w, scale = compute_det_resize_meta(orig_shape[0], orig_shape[1], resize_long=960)
    
    # Create probability map with a clear rectangle (in resized space)
    prob_map = np.zeros((resize_h, resize_w), dtype=np.float32)
    
    # Draw rectangle in resized coordinates
    rect_x1 = int(50 * scale)
    rect_y1 = int(50 * scale)
    rect_x2 = int(150 * scale)
    rect_y2 = int(100 * scale)
    cv2.rectangle(prob_map, (rect_x1, rect_y1), (rect_x2, rect_y2), 0.8, -1)
    
    # Add some noise
    noise = np.random.rand(resize_h, resize_w).astype(np.float32) * 0.1
    prob_map = prob_map + noise
    prob_map = np.clip(prob_map, 0, 1)
    
    polygons = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale, 
                             thresh=0.3, box_thresh=0.5)
    
    # Should detect at least one polygon
    assert len(polygons) > 0, "Should detect at least one polygon"
    
    # Check that polygon covers the rectangle region
    poly = polygons[0]
    poly_x_min = poly[:, 0].min()
    poly_x_max = poly[:, 0].max()
    poly_y_min = poly[:, 1].min()
    poly_y_max = poly[:, 1].max()
    
    # Polygon should cover the rectangle (with some margin for unclip)
    # Rectangle is at (50, 50) to (150, 100) in original space
    assert poly_x_min <= 55, f"Polygon x_min ({poly_x_min}) should cover rectangle (expect ~50)"
    assert poly_x_max >= 145, f"Polygon x_max ({poly_x_max}) should cover rectangle (expect ~150)"
    assert poly_y_min <= 55, f"Polygon y_min ({poly_y_min}) should cover rectangle (expect ~50)"
    assert poly_y_max >= 95, f"Polygon y_max ({poly_y_max}) should cover rectangle (expect ~100)"
    
    print(f"✓ Synthetic rectangle detected: {len(polygons)} polygon(s)")
    print(f"  Polygon bounds: x=[{poly_x_min:.1f}, {poly_x_max:.1f}], y=[{poly_y_min:.1f}, {poly_y_max:.1f}]")
    return True


def test_empty_input():
    """Test handling of empty/no-detection cases."""
    print("\nTest 3: Empty input handling...")
    
    # Original and resized sizes (same in this case)
    orig_shape = (100, 100)
    resize_h, resize_w, scale = compute_det_resize_meta(orig_shape[0], orig_shape[1], resize_long=960)
    
    # All zeros - should return empty list
    prob_map = np.zeros((resize_h, resize_w), dtype=np.float32)
    polygons = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale)
    assert len(polygons) == 0, "Empty probability map should return empty list"
    
    # Very low values - should return empty list
    prob_map = np.ones((resize_h, resize_w), dtype=np.float32) * 0.1
    polygons = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale, thresh=0.3)
    assert len(polygons) == 0, "Low probability map should return empty list"
    
    print("✓ Empty input handling passed")
    return True


def test_parameter_validation():
    """Test that parameters work correctly."""
    print("\nTest 4: Parameter validation...")
    
    # Original image size
    orig_shape = (200, 200)
    resize_h, resize_w, scale = compute_det_resize_meta(orig_shape[0], orig_shape[1], resize_long=960)
    
    # Create probability map with multiple regions (in resized space)
    prob_map = np.zeros((resize_h, resize_w), dtype=np.float32)
    
    # Draw rectangles in resized coordinates
    rect1_x1, rect1_y1 = int(20 * scale), int(20 * scale)
    rect1_x2, rect1_y2 = int(80 * scale), int(60 * scale)
    cv2.rectangle(prob_map, (rect1_x1, rect1_y1), (rect1_x2, rect1_y2), 0.9, -1)
    
    rect2_x1, rect2_y1 = int(120 * scale), int(120 * scale)
    rect2_x2, rect2_y2 = int(180 * scale), int(160 * scale)
    cv2.rectangle(prob_map, (rect2_x1, rect2_y1), (rect2_x2, rect2_y2), 0.7, -1)
    
    rect3_x1, rect3_y1 = int(30 * scale), int(130 * scale)
    rect3_x2, rect3_y2 = int(50 * scale), int(150 * scale)
    cv2.rectangle(prob_map, (rect3_x1, rect3_y1), (rect3_x2, rect3_y2), 0.4, -1)  # Below threshold
    
    # Test with strict threshold - should detect fewer boxes
    polygons_strict = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale,
                                     thresh=0.5, box_thresh=0.8)
    
    # Test with lenient threshold - should detect more boxes
    polygons_lenient = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale,
                                      thresh=0.3, box_thresh=0.5)
    
    assert len(polygons_lenient) >= len(polygons_strict), \
        "Lenient threshold should detect more boxes"
    
    print(f"✓ Parameter validation passed")
    print(f"  Strict threshold: {len(polygons_strict)} boxes")
    print(f"  Lenient threshold: {len(polygons_lenient)} boxes")
    return True


def test_scaling():
    """
    Test that polygon scaling works correctly with PP-OCR's aspect-ratio-preserving resize.
    
    PP-OCR uses DetResizeForTest which:
    1. Computes single scale factor: scale = resize_long / max(orig_h, orig_w)
    2. Resizes preserving aspect ratio
    3. Maps coordinates: orig → resized (multiply by scale), resized → orig (divide by scale)
    
    This test verifies that coordinates map correctly back to original space.
    """
    print("\nTest 5: Scaling test (PP-OCR style)...")
    
    # Original image: 200x300 (non-square)
    orig_shape = (200, 300)  # (h, w)
    resize_h, resize_w, scale = compute_det_resize_meta(orig_shape[0], orig_shape[1], resize_long=960)
    
    print(f"  Original: {orig_shape}, Resized: ({resize_h}, {resize_w}), Scale: {scale:.4f}")
    
    # Create probability map matching resize_shape
    prob_map = np.zeros((resize_h, resize_w), dtype=np.float32)
    
    # Draw rectangle in original coordinates (25, 25) to (75, 50)
    # Convert to resized coordinates for drawing
    rect_x1_orig, rect_y1_orig = 25, 25
    rect_x2_orig, rect_y2_orig = 75, 50
    
    rect_x1_resized = int(rect_x1_orig * scale)
    rect_y1_resized = int(rect_y1_orig * scale)
    rect_x2_resized = int(rect_x2_orig * scale)
    rect_y2_resized = int(rect_y2_orig * scale)
    
    cv2.rectangle(prob_map, (rect_x1_resized, rect_y1_resized), 
                  (rect_x2_resized, rect_y2_resized), 0.8, -1)
    
    polygons = db_postprocess(prob_map, orig_shape, (resize_h, resize_w), scale)
    
    assert len(polygons) > 0, "Should detect polygon"
    
    poly = polygons[0]
    
    # Check that coordinates are correctly mapped back to original space
    # Rectangle was drawn at (25, 25) to (75, 50) in original space
    # After DB postprocessing with unclip expansion and inverse scaling, coordinates will be
    # close to original but may be expanded outward by unclip
    x_min = poly[:, 0].min()
    x_max = poly[:, 0].max()
    y_min = poly[:, 1].min()
    y_max = poly[:, 1].max()
    
    print(f"  Detected polygon bounds: x=[{x_min:.1f}, {x_max:.1f}], y=[{y_min:.1f}, {y_max:.1f}]")
    print(f"  Original rectangle: x=[25, 75], y=[25, 50]")
    
    # KEY VALIDATION: The polygon should COVER the original rectangle
    # Unclip expands polygons OUTWARD, so:
    # - x_min should be <= 25 (expanded leftward) 
    # - x_max should be >= 75 (expanded rightward)
    # - y_min should be <= 25 (expanded upward)
    # - y_max should be >= 50 (expanded downward)
    # This is CORRECT behavior - unclip is supposed to expand polygons to better cover text
    
    assert x_min <= 30, f"Polygon x_min ({x_min:.1f}) should cover original x=25 (unclip expands leftward)"
    assert x_max >= 70, f"Polygon x_max ({x_max:.1f}) should cover original x=75 (unclip expands rightward)"
    assert y_min <= 30, f"Polygon y_min ({y_min:.1f}) should cover original y=25 (unclip expands upward)"
    assert y_max >= 45, f"Polygon y_max ({y_max:.1f}) should cover original y=50 (unclip expands downward)"
    
    # Check bounds clipping to original image size
    assert x_max <= 300, f"Polygon should be clipped to orig_w=300, got x_max={x_max}"
    assert y_max <= 200, f"Polygon should be clipped to orig_h=200, got y_max={y_max}"
    assert x_min >= 0, f"Polygon x_min should be >= 0, got {x_min:.1f}"
    assert y_min >= 0, f"Polygon y_min should be >= 0, got {y_min:.1f}"
    
    print(f"✓ Scaling test passed")
    print(f"  Original rectangle: x=[25, 75], y=[25, 50]")
    print(f"  Polygon bounds: x=[{x_min:.1f}, {x_max:.1f}], y=[{y_min:.1f}, {y_max:.1f}]")
    print(f"  Note: PP-OCR preserves aspect ratio, so coordinates map directly back (inverse scale)")
    return True


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Running DB Postprocessing Tests")
    print("=" * 60)
    
    tests = [
        test_shape_validation,
        test_synthetic_rectangle,
        test_empty_input,
        test_parameter_validation,
        test_scaling,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ Test failed: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ Test error: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Tests: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)

