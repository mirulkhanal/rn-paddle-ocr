package com.receiptscanner.ocr.db

/**
 * Metadata for PP-OCRv5 detection preprocessing resize operation.
 * 
 * This matches the Python compute_det_resize_meta function behavior exactly:
 * - scale = resize_long / max(orig_h, orig_w)
 * - resize_h = round(orig_h * scale)
 * - resize_w = round(orig_w * scale)
 * 
 * The resize preserves aspect ratio (single scale factor, not separate x/y scaling).
 */
data class DetResizeMeta(
    val origH: Int,
    val origW: Int,
    val resizeH: Int,
    val resizeW: Int,
    val scale: Float
) {
    companion object {
        /**
         * Compute resize metadata for PP-OCRv5 detection preprocessing.
         * 
         * This is a 1:1 port of Python compute_det_resize_meta function.
         * 
         * @param origH Original image height
         * @param origW Original image width
         * @param resizeLong Target size for long side (default: 960)
         * @return DetResizeMeta with computed resize dimensions and scale factor
         */
        fun computeDetResizeMeta(
            origH: Int,
            origW: Int,
            resizeLong: Int = 960
        ): DetResizeMeta {
            // Match Python: scale = resize_long / max(orig_h, orig_w)
            val longSide = maxOf(origH, origW)
            val scale = resizeLong.toFloat() / longSide
            
            // Match Python: resize_h = int(round(orig_h * scale))
            // Match Python: resize_w = int(round(orig_w * scale))
            val resizeH = kotlin.math.round(origH * scale).toInt()
            val resizeW = kotlin.math.round(origW * scale).toInt()
            
            return DetResizeMeta(
                origH = origH,
                origW = origW,
                resizeH = resizeH,
                resizeW = resizeW,
                scale = scale
            )
        }
    }
}
