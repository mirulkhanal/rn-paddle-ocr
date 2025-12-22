package com.receiptscanner.db

import com.receiptscanner.ocr.db.DBPostProcessor
import com.receiptscanner.ocr.db.DetResizeMeta
import com.receiptscanner.ocr.db.PolygonUtils
import org.junit.Assert.*
import org.junit.BeforeClass
import org.junit.Test
import kotlin.random.Random
import org.opencv.core.Core
import nu.pattern.OpenCV

/**
 * JVM unit tests for DBPostProcessor.
 *
 * These are a direct port of the Python tests in test_db_postprocess.py.
 * Python behavior is authoritative – if any of these fail, the Kotlin
 * implementation is incorrect.
 * 
 * NOTE: OpenCV must be initialized before running tests.
 * See TESTING_DB_POSTPROCESS.md for setup instructions.
 */
class DBPostProcessorTest {
    
    companion object {
        /**
         * Initialize OpenCV before running tests.
         * This loads the OpenCV native library required for contour operations.
         * 
         * IMPORTANT: This method must load the OpenCV native library.
         * The exact initialization depends on your OpenCV distribution:
         * 
         * For OpenCV Java (org.openpnp:opencv):
         *   nu.pattern.OpenCV.loadLocally()
         * 
         * For other OpenCV Java distributions:
         *   System.loadLibrary(Core.NATIVE_LIBRARY_NAME)
         *   Or load from specific path: System.load("/path/to/libopencv_java.so")
         * 
         * If using Android instrumented tests with OpenCV Android SDK:
         *   Use OpenCVLoader.initDebug() or OpenCVLoader.initAsync()
         * 
         * Note: This uses OpenCV Java (desktop version) for JVM tests.
         * For Android instrumented tests, use OpenCV Android SDK initialization.
         */
        @JvmStatic
        @BeforeClass
        fun setupOpenCV() {
            try {
                // Load OpenCV native library
                // For OpenCV Java (org.openpnp:opencv), use:
                nu.pattern.OpenCV.loadLocally()
                
                // Alternative: If using different OpenCV Java distribution:
                // System.loadLibrary(Core.NATIVE_LIBRARY_NAME)
                
                // Alternative: Load from specific path (adjust path as needed)
                // System.load("/path/to/libopencv_java.so")
                
                println("OpenCV loaded successfully: ${Core.VERSION}")
            } catch (e: Exception) {
                System.err.println("Failed to load OpenCV: ${e.message}")
                System.err.println("Tests will fail. Ensure OpenCV Java is properly installed.")
                System.err.println("See TESTING_DB_POSTPROCESS.md for setup instructions.")
                throw e
            }
        }
    }

    @Test
    fun testShapeValidation() {
        // Dummy probability map (after sigmoid) with sparse detections
        val resizeMeta = DetResizeMeta.computeDetResizeMeta(1280, 1280, 960)
        val h = resizeMeta.resizeH
        val w = resizeMeta.resizeW
        // Create probability map with sparse detections (low values)
        val probMap = FloatArray(h * w) { PolygonUtils.sigmoid(Random.nextFloat() - 2.0f) }

        val polys = DBPostProcessor.dbPostProcess(
            probMap = probMap,
            probH = h,
            probW = w,
            resizeMeta = resizeMeta
        )

        // Output is list of polygons with proper shape
        for (poly in polys) {
            assertTrue(poly.points.size >= 6)
            assertEquals(0, poly.points.size % 2)
        }
    }

    @Test
    fun testSyntheticRectangle() {
        // Original image 200x200
        val origH = 200
        val origW = 200
        val meta = DetResizeMeta.computeDetResizeMeta(origH, origW, 960)
        val h = meta.resizeH
        val w = meta.resizeW

        val prob = FloatArray(h * w) { 0f }

        // Draw rectangle in resized space corresponding to (50,50)-(150,100) orig
        val scale = meta.scale
        val x1 = (50 * scale).toInt()
        val y1 = (50 * scale).toInt()
        val x2 = (150 * scale).toInt()
        val y2 = (100 * scale).toInt()
        for (y in y1 until y2) {
            for (x in x1 until x2) {
                prob[y * w + x] = 0.8f
            }
        }

        val polys = DBPostProcessor.dbPostProcess(
            probMap = prob,
            probH = h,
            probW = w,
            resizeMeta = meta,
            thresh = 0.3f,
            boxThresh = 0.5f
        )

        assertTrue("Should detect at least one polygon", polys.isNotEmpty())

        val poly = polys[0]
        val xs = poly.points.filterIndexed { idx, _ -> idx % 2 == 0 }
        val ys = poly.points.filterIndexed { idx, _ -> idx % 2 == 1 }
        val xMin = xs.minOrNull() ?: 0f
        val xMax = xs.maxOrNull() ?: 0f
        val yMin = ys.minOrNull() ?: 0f
        val yMax = ys.maxOrNull() ?: 0f

        // Polygon should cover the original rectangle (50-150, 50-100) in orig space
        assertTrue(xMin <= 55f)
        assertTrue(xMax >= 145f)
        assertTrue(yMin <= 55f)
        assertTrue(yMax >= 95f)
    }

    @Test
    fun testEmptyInput() {
        val meta = DetResizeMeta.computeDetResizeMeta(100, 100, 960)
        val h = meta.resizeH
        val w = meta.resizeW

        // All zeros
        val prob = FloatArray(h * w) { 0f }
        val polys1 = DBPostProcessor.dbPostProcess(prob, h, w, meta)
        assertTrue(polys1.isEmpty())

        // Very low values
        val prob2 = FloatArray(h * w) { 0.1f }
        val polys2 = DBPostProcessor.dbPostProcess(prob2, h, w, meta, thresh = 0.3f)
        assertTrue(polys2.isEmpty())
    }

    @Test
    fun testParameterValidation() {
        val origH = 200
        val origW = 200
        val meta = DetResizeMeta.computeDetResizeMeta(origH, origW, 960)
        val h = meta.resizeH
        val w = meta.resizeW
        val scale = meta.scale

        val prob = FloatArray(h * w) { 0f }

        fun drawRect(x1Orig: Int, y1Orig: Int, x2Orig: Int, y2Orig: Int, value: Float) {
            val x1 = (x1Orig * scale).toInt()
            val y1 = (y1Orig * scale).toInt()
            val x2 = (x2Orig * scale).toInt()
            val y2 = (y2Orig * scale).toInt()
            for (y in y1 until y2) {
                for (x in x1 until x2) {
                    prob[y * w + x] = value
                }
            }
        }

        drawRect(20, 20, 80, 60, 0.9f)
        drawRect(120, 120, 180, 160, 0.7f)
        drawRect(30, 130, 50, 150, 0.4f) // below threshold in strict mode

        val strict = DBPostProcessor.dbPostProcess(
            probMap = prob,
            probH = h,
            probW = w,
            resizeMeta = meta,
            thresh = 0.5f,
            boxThresh = 0.8f
        )
        val lenient = DBPostProcessor.dbPostProcess(
            probMap = prob,
            probH = h,
            probW = w,
            resizeMeta = meta,
            thresh = 0.3f,
            boxThresh = 0.5f
        )

        assertTrue(lenient.size >= strict.size)
    }

    @Test
    fun testScaling() {
        // Original: 200x300, non-square
        val origH = 200
        val origW = 300
        val meta = DetResizeMeta.computeDetResizeMeta(origH, origW, 960)
        val h = meta.resizeH
        val w = meta.resizeW
        val scale = meta.scale

        val prob = FloatArray(h * w) { 0f }

        // Draw rectangle (25,25)-(75,50) in original, mapped to resized
        val rectX1Orig = 25
        val rectY1Orig = 25
        val rectX2Orig = 75
        val rectY2Orig = 50

        val x1 = (rectX1Orig * scale).toInt()
        val y1 = (rectY1Orig * scale).toInt()
        val x2 = (rectX2Orig * scale).toInt()
        val y2 = (rectY2Orig * scale).toInt()

        for (y in y1 until y2) {
            for (x in x1 until x2) {
                prob[y * w + x] = 0.8f
            }
        }

        val polys = DBPostProcessor.dbPostProcess(prob, h, w, meta)
        assertTrue(polys.isNotEmpty())

        val poly = polys[0]
        val xs = poly.points.filterIndexed { idx, _ -> idx % 2 == 0 }
        val ys = poly.points.filterIndexed { idx, _ -> idx % 2 == 1 }
        val xMin = xs.minOrNull() ?: 0f
        val xMax = xs.maxOrNull() ?: 0f
        val yMin = ys.minOrNull() ?: 0f
        val yMax = ys.maxOrNull() ?: 0f

        // Key validation: polygon must cover the original rectangle, accounting for unclip
        assertTrue("xMin should be <= 30, got $xMin", xMin <= 30f)
        assertTrue("xMax should be >= 70, got $xMax", xMax >= 70f)
        assertTrue("yMin should be <= 30, got $yMin", yMin <= 30f)
        assertTrue("yMax should be >= 45, got $yMax", yMax >= 45f)

        // And must be within original bounds
        assertTrue(xMax <= origW.toFloat() + 1e-3f)
        assertTrue(yMax <= origH.toFloat() + 1e-3f)
        assertTrue(xMin >= -1e-3f)
        assertTrue(yMin >= -1e-3f)
    }
}


