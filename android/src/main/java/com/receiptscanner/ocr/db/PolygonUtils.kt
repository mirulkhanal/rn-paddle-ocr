package com.receiptscanner.ocr.db

/**
 * Utility functions for polygon operations.
 * 
 * These are 1:1 ports of Python polygon utility functions from db_postprocess.py.
 */

object PolygonUtils {
    /**
     * Check if polygon vertices are in clockwise order using shoelace formula.
     * 
     * This is a 1:1 port of Python is_clockwise function.
     * Uses shoelace formula: positive area = counter-clockwise, negative = clockwise
     * 
     * @param points FloatArray in format [x1, y1, x2, y2, ...]
     * @return true if clockwise, false if counter-clockwise
     */
    /**
     * Check if polygon vertices are in clockwise order using shoelace formula.
     * 
     * This is a 1:1 port of Python is_clockwise function.
     * Uses shoelace formula: positive area = counter-clockwise, negative = clockwise
     * 
     * Python implementation:
     * x = polygon[:, 0]
     * y = polygon[:, 1]
     * area = np.sum((x[1:] - x[:-1]) * (y[1:] + y[:-1]))
     * return area < 0
     * 
     * @param points FloatArray in format [x1, y1, x2, y2, ...]
     * @return true if clockwise, false if counter-clockwise
     */
    fun isClockwise(points: FloatArray): Boolean {
        if (points.size < 6) { // Need at least 3 points (6 values: x1,y1,x2,y2,x3,y3)
            return false
        }
        
        val n = points.size / 2
        
        // Shoelace formula matching Python: sum((x[1:] - x[:-1]) * (y[1:] + y[:-1]))
        // Positive area = counter-clockwise, negative = clockwise
        var area = 0.0
        
        for (i in 0 until n) {
            val x = points[2 * i].toDouble()
            val y = points[2 * i + 1].toDouble()
            val nextIdx = (i + 1) % n
            val nextX = points[2 * nextIdx].toDouble()
            val nextY = points[2 * nextIdx + 1].toDouble()
            
            area += (nextX - x) * (nextY + y)
        }
        
        return area < 0
    }
    
    /**
     * Apply sigmoid activation to convert logits to probabilities.
     * 
     * This is a 1:1 port of Python sigmoid function.
     * Clips input to [-500, 500] to prevent overflow, then applies sigmoid.
     * 
     * @param x Input value (logit)
     * @return Probability (0.0 to 1.0)
     */
    fun sigmoid(x: Float): Float {
        val clipped = x.coerceIn(-500f, 500f)
        return 1.0f / (1.0f + kotlin.math.exp(-clipped))
    }
}
