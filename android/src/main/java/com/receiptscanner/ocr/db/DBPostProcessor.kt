package com.receiptscanner.ocr.db

import clipper2.core.*
import clipper2.offset.*
import clipper2.engine.*
import clipper2.*
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.util.ArrayList
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class Polygon(val points: List<Float>)

object DBPostProcessor {

    /**
     * Postprocess detection model probability map to extract text polygon boxes.
     *
     * Matches Python db_postprocess behavior.
     */
    fun dbPostProcess(
        probMap: FloatArray,
        probH: Int,
        probW: Int,
        resizeMeta: DetResizeMeta,
        thresh: Float = 0.3f,
        boxThresh: Float = 0.6f,
        unclipRatio: Float = 1.5f,
        maxCandidates: Int = 1000,
        minArea: Float = 300f
    ): List<Polygon> {
        
        // Convert FloatArray to Mat
        val probMat = Mat(probH, probW, CvType.CV_32FC1)
        probMat.put(0, 0, probMap)

        // Step 1: Apply threshold to create binary map
        // Python: binary = (prob_map > thresh).astype(np.uint8) * 255
        val binary = Mat()
        Imgproc.threshold(probMat, binary, thresh.toDouble(), 255.0, Imgproc.THRESH_BINARY)
        val binaryUint8 = Mat()
        binary.convertTo(binaryUint8, CvType.CV_8UC1)

        // Step 2: Find connected components
        val contours = ArrayList<MatOfPoint>()
        val hierarchy = Mat()
        Imgproc.findContours(
            binaryUint8,
            contours,
            hierarchy,
            Imgproc.RETR_EXTERNAL,
            Imgproc.CHAIN_APPROX_SIMPLE
        )

        if (contours.isEmpty()) {
            return emptyList()
        }

        val polygons = ArrayList<Polygon>()
        val scale = resizeMeta.scale
        val origH = resizeMeta.origH
        val origW = resizeMeta.origW

        for (contour in contours) {
            // Step 3: Filter by area
            val area = Imgproc.contourArea(contour)
            if (area < minArea) {
                continue
            }

            // Compute mean score
            // Create mask
            val mask = Mat.zeros(probH, probW, CvType.CV_8UC1)
            val contourList = listOf(contour)
            Imgproc.drawContours(mask, contourList, -1, Scalar(255.0), -1) // Fill
            
            // Mean score
            val meanScore = Core.mean(probMat, mask).`val`[0]
            if (meanScore < boxThresh) {
                continue
            }

            // Step 4: Extract polygon from contour
            val contour2f = MatOfPoint2f(*contour.toArray())
            val perimeter = Imgproc.arcLength(contour2f, true)
            val epsilon = 0.005 * perimeter // Match Python 0.005
            val approx = MatOfPoint2f()
            Imgproc.approxPolyDP(contour2f, approx, epsilon, true)

            if (approx.rows() < 3) {
                continue
            }

            var polygonPoints = approx.toArray() // Array<Point>

            // Step 5: Unclip
            val unclippedPoints = unclip(polygonPoints, unclipRatio, area) ?: continue
            polygonPoints = unclippedPoints

            // Step 6: Scale back to original
            val scaledPoints = ArrayList<Float>()
            for (p in polygonPoints) {
                var x = p.x / scale
                var y = p.y / scale

                // Step 7: Clip to bounds
                x = max(0.0, min(x, origW.toDouble()))
                y = max(0.0, min(y, origH.toDouble()))
                
                scaledPoints.add(x.toFloat())
                scaledPoints.add(y.toFloat())
            }
            
            // Check if clockwise
            // We need a FloatArray for PolygonUtils.isClockwise
            val floatArray = scaledPoints.toFloatArray()
            if (!PolygonUtils.isClockwise(floatArray)) {
                // Reverse
                val reversed = ArrayList<Float>()
                for (i in 0 until scaledPoints.size / 2) {
                    val idx = (scaledPoints.size / 2 - 1 - i)
                    reversed.add(scaledPoints[2 * idx])
                    reversed.add(scaledPoints[2 * idx + 1])
                }
                polygons.add(Polygon(reversed))
            } else {
                polygons.add(Polygon(scaledPoints))
            }

            if (polygons.size >= maxCandidates) {
                break
            }
        }

        return polygons
    }

    private fun unclip(points: Array<org.opencv.core.Point>, unclipRatio: Float, area: Double): Array<org.opencv.core.Point>? {
        val contour2f = MatOfPoint2f(*points)
        val perimeter = Imgproc.arcLength(contour2f, true)
        if (perimeter < 1e-6) return null

        val distance = area * unclipRatio / perimeter
        
        // Scale up for Clipper (integer coordinates)
        val scale = 1000.0
        val path = Path64()
        for (p in points) {
            path.add(Point64((p.x * scale).toLong(), (p.y * scale).toLong()))
        }

        val co = ClipperOffset()
        co.AddPath(path, JoinType.Round, EndType.Polygon)
        
        val solution = Paths64()
        co.Execute(distance * scale, solution)

        if (solution.isEmpty()) return null

        // Find largest polygon
        var maxArea = -1.0
        var bestPath: Path64? = null
        
        for (p in solution) {
             val pArea = kotlin.math.abs(Clipper.Area(p))
             if (pArea > maxArea) {
                 maxArea = pArea
                 bestPath = p
             }
        }
        
        if (bestPath == null) return null

        val resultPoints = ArrayList<org.opencv.core.Point>()
        for (lp in bestPath) {
            resultPoints.add(org.opencv.core.Point(lp.x.toDouble() / scale, lp.y.toDouble() / scale))
        }

        return resultPoints.toTypedArray()
    }
}
