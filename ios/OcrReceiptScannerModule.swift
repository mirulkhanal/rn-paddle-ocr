import Foundation
import React
import UIKit
import ONNXRuntime

/**
 * React Native module for OCR receipt scanning using PaddleOCR models via ONNX Runtime
 * 
 * This module handles:
 * 1. Loading ONNX models (detection, recognition, CLS) from bundle
 * 2. Image preprocessing and normalization
 * 3. Running OCR inference pipeline (CLS -> Detection -> Recognition)
 * 4. Extracting structured receipt data from OCR results
 */
@objc(OcrReceiptScannerModule)
class OcrReceiptScannerModule: RCTEventEmitter, RCTBridgeModule {
    
    static func moduleName() -> String {
        return "OcrReceiptScanner"
    }
    
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    // Model file paths in bundle
    private let MODEL_DET = "det.onnx"
    private let MODEL_REC = "rec.onnx"
    private let MODEL_CLS = "cls.onnx"
    private let CHAR_DICT_FILE = "ppocr_keys_v1"
    
    // Image preprocessing constants for PaddleOCR models
    private let DET_INPUT_SIZE = 960
    private let REC_INPUT_HEIGHT = 48
    private let CLS_INPUT_SIZE = 192
    private let MEAN: [Float] = [0.485, 0.485, 0.485]
    private let STD: [Float] = [0.229, 0.229, 0.229]
    
    // CTC decoding constants
    private let CTC_BLANK_INDEX = 0 // Index 0 is always the BLANK token in CTC
    
    // Cache ONNX Runtime sessions to avoid reloading models
    private var detSession: ORTSession?
    private var recSession: ORTSession?
    private var clsSession: ORTSession?
    private var ortEnvironment: ORTEnv?
    private var initialized = false
    
    // Character dictionary for CTC decoding
    // Index 0 is BLANK token, indices 1+ are actual characters
    private var charDict: [String] = []
    
    override init() {
        super.init()
        // Initialize ONNX Runtime environment
        do {
            ortEnvironment = try ORTEnv(loggingLevel: .warning)
        } catch {
            print("Failed to initialize ONNX Runtime environment: \(error)")
        }
    }
    
    /**
     * Initialize OCR models by loading ONNX models from bundle
     * This method loads all three models (detection, recognition, CLS) into memory
     * Models are cached for performance - only loaded once
     */
    @objc
    func initialize(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try self.loadModels()
                self.initialized = true
                resolve(nil)
            } catch {
                reject("INIT_ERROR", "Failed to initialize models: \(error.localizedDescription)", error)
            }
        }
    }
    
    /**
     * Load ONNX models from iOS bundle resources
     * Models are read from the app bundle
     */
    private func loadModels() throws {
        guard let env = ortEnvironment else {
            throw NSError(domain: "OcrReceiptScanner", code: -1, userInfo: [NSLocalizedDescriptionKey: "ONNX Runtime environment not initialized"])
        }
        
        guard let detPath = Bundle.main.path(forResource: "det", ofType: "onnx", inDirectory: "Models"),
              let recPath = Bundle.main.path(forResource: "rec", ofType: "onnx", inDirectory: "Models"),
              let clsPath = Bundle.main.path(forResource: "cls", ofType: "onnx", inDirectory: "Models") else {
            throw NSError(domain: "OcrReceiptScanner", code: -2, userInfo: [NSLocalizedDescriptionKey: "Model files not found in bundle"])
        }
        
        // Load detection model - used to find text regions in images
        let detData = try Data(contentsOf: URL(fileURLWithPath: detPath))
        detSession = try ORTSession(env: env, modelPath: detPath, sessionOptions: nil)
        
        // Load recognition model - used to extract text from detected regions
        let recData = try Data(contentsOf: URL(fileURLWithPath: recPath))
        recSession = try ORTSession(env: env, modelPath: recPath, sessionOptions: nil)
        
        // Load CLS (classification) model - used to correct image orientation
        let clsData = try Data(contentsOf: URL(fileURLWithPath: clsPath))
        clsSession = try ORTSession(env: env, modelPath: clsPath, sessionOptions: nil)
        
        // Load character dictionary for CTC decoding
        // Dictionary file format: one character per line, first line is BLANK token (index 0)
        loadCharacterDictionary()
        
        print("All models loaded successfully")
    }
    
    /**
     * Load character dictionary from bundle resource
     * Dictionary is used for CTC decoding to convert indices to characters
     * Format: one character per line, index 0 is BLANK token
     */
    private func loadCharacterDictionary() {
        guard let dictPath = Bundle.main.path(forResource: CHAR_DICT_FILE, ofType: "txt") else {
            print("Character dictionary file not found, using default")
            charDict = buildDefaultDictionary()
            return
        }
        
        do {
            let dictContent = try String(contentsOfFile: dictPath, encoding: .utf8)
            charDict = dictContent.components(separatedBy: .newlines).filter { !$0.isEmpty }
            print("Character dictionary loaded with \(charDict.count) entries")
        } catch {
            print("Failed to load character dictionary: \(error), using default")
            charDict = buildDefaultDictionary()
        }
    }
    
    /**
     * Build default character dictionary if file loading fails
     * Includes numbers, letters, and common Chinese/English punctuation
     */
    private func buildDefaultDictionary() -> [String] {
        var defaultDict: [String] = []
        
        // Index 0: BLANK token (CTC requirement)
        defaultDict.append("")
        
        // Numbers
        defaultDict.append(contentsOf: (0...9).map { String($0) })
        
        // Uppercase letters
        defaultDict.append(contentsOf: (65...90).compactMap { Character(UnicodeScalar($0)!)
            }.map { String($0) })
        
        // Lowercase letters
        defaultDict.append(contentsOf: (97...122).compactMap { Character(UnicodeScalar($0)!)
            }.map { String($0) })
        
        // Common punctuation
        defaultDict.append(contentsOf: ["!", "\"", "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/", ":", ";", "<", "=", ">", "?", "@", "[", "\\", "]", "^", "_", "`", "{", "|", "}", "~"])
        
        // Common Chinese punctuation
        defaultDict.append(contentsOf: ["。", "，", "、", "：", "；", "？", "！", "…", "—", "（", "）", "【", "】", "《", "》"])
        
        return defaultDict
    }
    
    /**
     * Main method to scan receipt from image
     * Processes the image through the complete OCR pipeline and returns structured data
     * 
     * @param imageUri URI pointing to the image file (file://, asset://, http://, https://)
     * @param resolve Promise resolve block for ReceiptData object with extracted fields
     * @param reject Promise reject block for error handling
     */
    @objc
    func scanReceipt(_ imageUri: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if !initialized {
            reject("NOT_INITIALIZED", "OCR models not initialized. Call initialize() first.", nil)
            return
        }
        
        // Process image on background thread to avoid blocking UI
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let receiptData = try self.processReceiptImage(imageUri: imageUri)
                let result = self.createReceiptDataDict(data: receiptData)
                resolve(result)
            } catch {
                print("Receipt scanning failed: \(error)")
                reject("SCAN_ERROR", "Failed to scan receipt: \(error.localizedDescription)", error)
            }
        }
    }
    
    /**
     * Process receipt image through complete OCR pipeline
     * Pipeline: Load Image -> CLS (orientation) -> Detection -> Recognition -> Extraction
     */
    private func processReceiptImage(imageUri: String) throws -> ReceiptData {
        // Load and decode image from URI
        let image = try loadImageFromUri(uri: imageUri)
        
        // Run CLS model to detect and correct image orientation
        let correctedImage = try correctImageOrientation(image: image)
        
        // Run detection model to find text bounding boxes
        let textBoxes = try detectTextRegions(image: correctedImage)
        
        // Run recognition model on each detected text region
        let ocrResults = try recognizeText(image: correctedImage, textBoxes: textBoxes)
        
        // Extract structured receipt fields from OCR text
        return extractReceiptFields(ocrResults: ocrResults)
    }
    
    /**
     * Load UIImage from URI (supports file://, asset://, http://, https://)
     */
    private func loadImageFromUri(uri: String) throws -> UIImage {
        if uri.hasPrefix("file://") {
            let filePath = String(uri.dropFirst(7))
            guard let image = UIImage(contentsOfFile: filePath) else {
                throw NSError(domain: "OcrReceiptScanner", code: -3, userInfo: [NSLocalizedDescriptionKey: "Cannot load image from file: \(filePath)"])
            }
            return image
        } else if uri.hasPrefix("http://") || uri.hasPrefix("https://") {
            // For remote URLs, download first (simplified - production should use proper HTTP client)
            throw NSError(domain: "OcrReceiptScanner", code: -4, userInfo: [NSLocalizedDescriptionKey: "Remote URL download not implemented in native code. Download in JS layer first."])
        } else {
            guard let image = UIImage(contentsOfFile: uri) else {
                throw NSError(domain: "OcrReceiptScanner", code: -3, userInfo: [NSLocalizedDescriptionKey: "Cannot load image from URI: \(uri)"])
            }
            return image
        }
    }
    
    /**
     * Correct image orientation using CLS (Classification) model
     * Detects if image is rotated and rotates it to correct orientation
     */
    private func correctImageOrientation(image: UIImage) throws -> UIImage {
        guard let cls = clsSession else {
            return image
        }
        
        // Preprocess image for CLS model input
        let inputTensor = try preprocessImageForCls(image: image)
        
        // Run CLS inference to detect rotation angle
        // TODO: Implement proper CLS inference with ONNX Runtime
        // let outputs = try cls.run(withInputs: ["x": inputTensor])
        // let clsId = outputs["output"] // Extract class ID from output
        
        // CLS model output: 0 = 0°, 1 = 180° rotation needed
        // if clsId == 1 {
        //     return rotateImage(image: image, degrees: 180)
        // }
        
        return image
    }
    
    /**
     * Detect text regions in image using detection model
     * Returns list of bounding boxes for each text region
     */
    private func detectTextRegions(image: UIImage) throws -> [TextBox] {
        guard let det = detSession else {
            return []
        }
        
        // Preprocess image for detection model
        let (inputTensor, scale) = try preprocessImageForDetection(image: image)
        
        // Run detection inference
        // TODO: Implement proper detection inference with ONNX Runtime
        // let outputs = try det.run(withInputs: ["x": inputTensor])
        // let outputTensor = outputs["output"]
        
        // Postprocess detection results to extract bounding boxes
        // return try postprocessDetection(output: outputTensor, scale: scale, originalWidth: Int(image.size.width), originalHeight: Int(image.size.height))
        
        return []
    }
    
    /**
     * Recognize text from detected regions using recognition model
     * Processes each text region and extracts the actual text content
     */
    private func recognizeText(image: UIImage, textBoxes: [TextBox]) throws -> [OcrResult] {
        guard let rec = recSession else {
            return []
        }
        
        var results: [OcrResult] = []
        
        // Process each detected text box
        for box in textBoxes {
            // Crop and preprocess the text region
            let croppedImage = cropTextRegion(image: image, box: box)
            let inputTensor = try preprocessImageForRecognition(image: croppedImage)
            
            // Run recognition inference
            // TODO: Implement proper recognition inference with ONNX Runtime
            // let outputs = try rec.run(withInputs: ["x": inputTensor])
            // let outputTensor = outputs["output"]
            
            // Decode recognition output to text string
            // let text = decodeRecognitionOutput(output: outputTensor)
            
            // results.append(OcrResult(text: text, box: box))
        }
        
        return results
    }
    
    /**
     * Extract structured receipt fields from OCR results
     * Uses regex patterns and keyword matching to find receipt number, amounts, dates, etc.
     */
    private func extractReceiptFields(ocrResults: [OcrResult]) -> ReceiptData {
        // Combine all OCR text for pattern matching
        let allText = ocrResults.map { $0.text }.joined(separator: "\n")
        
        // Extract receipt number - look for patterns like "Receipt #123", "Invoice No: 456", "单据号: 789"
        let receiptNumber = extractReceiptNumber(text: allText, results: ocrResults)
        
        // Extract shop name - typically found in header region (first few lines)
        let shopName = extractShopName(results: ocrResults)
        
        // Extract gross amount - look for "Total", "合计", "总计" patterns
        let grossAmount = extractGrossAmount(text: allText)
        
        // Extract net amount - look for "Net", "净额", "小计" patterns
        let netAmount = extractNetAmount(text: allText)
        
        // Extract date - parse various date formats
        let date = extractDate(text: allText)
        
        // Extract time - parse time formats (HH:MM, HH:MM:SS)
        let time = extractTime(text: allText)
        
        // Count total items - count item lines or find "Items" label
        let totalItems = extractTotalItems(results: ocrResults)
        
        return ReceiptData(
            receiptNumber: receiptNumber,
            totalItems: totalItems,
            grossAmount: grossAmount,
            netAmount: netAmount,
            date: date,
            time: time,
            shopName: shopName
        )
    }
    
    // MARK: - Field Extraction Methods
    
    /**
     * Extract receipt number using multilingual patterns
     */
    private func extractReceiptNumber(text: String, results: [OcrResult]) -> String? {
        // English patterns
        let englishPatterns = [
            try! NSRegularExpression(pattern: "(?i)(?:receipt|invoice)\\s*[#:]*\\s*(\\d+)", options: .caseInsensitive),
            try! NSRegularExpression(pattern: "(?i)no\\.?\\s*[:：]?\\s*(\\d+)", options: .caseInsensitive)
        ]
        
        // Chinese patterns (simplified and traditional)
        let chinesePatterns = [
            try! NSRegularExpression(pattern: "单据号[：: ]*(\\d+)", options: []),
            try! NSRegularExpression(pattern: "发票号[：: ]*(\\d+)", options: []),
            try! NSRegularExpression(pattern: "单号[：: ]*(\\d+)", options: [])
        ]
        
        // Try English patterns first
        for pattern in englishPatterns {
            if let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let numberRange = Range(match.range(at: 1), in: text) {
                return String(text[numberRange])
            }
        }
        
        // Try Chinese patterns
        for pattern in chinesePatterns {
            if let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let numberRange = Range(match.range(at: 1), in: text) {
                return String(text[numberRange])
            }
        }
        
        return nil
    }
    
    /**
     * Extract shop name from header region (typically first 2-3 lines of receipt)
     */
    private func extractShopName(results: [OcrResult]) -> String? {
        guard let firstResult = results.first else {
            return nil
        }
        let shopName = firstResult.text.trimmingCharacters(in: .whitespacesAndNewlines)
        return shopName.isEmpty ? nil : shopName
    }
    
    /**
     * Extract gross amount (total) using multilingual patterns
     */
    private func extractGrossAmount(text: String) -> Float? {
        // English patterns: "Total: $123.45", "Total 123.45"
        let englishPattern = try! NSRegularExpression(pattern: "(?i)total[：: ]*\\$?\\s*(\\d+\\.?\\d*)", options: .caseInsensitive)
        
        // Chinese patterns: "合计: 123.45", "总计: 123.45"
        let chinesePatterns = [
            try! NSRegularExpression(pattern: "合计[：: ]*[￥$]?\\s*(\\d+\\.?\\d*)", options: []),
            try! NSRegularExpression(pattern: "总计[：: ]*[￥$]?\\s*(\\d+\\.?\\d*)", options: []),
            try! NSRegularExpression(pattern: "总额[：: ]*[￥$]?\\s*(\\d+\\.?\\d*)", options: [])
        ]
        
        // Try English pattern
        if let match = englishPattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let amountRange = Range(match.range(at: 1), in: text) {
            return Float(String(text[amountRange]))
        }
        
        // Try Chinese patterns
        for pattern in chinesePatterns {
            if let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let amountRange = Range(match.range(at: 1), in: text) {
                return Float(String(text[amountRange]))
            }
        }
        
        return nil
    }
    
    /**
     * Extract net amount (subtotal) using multilingual patterns
     */
    private func extractNetAmount(text: String) -> Float? {
        // English patterns: "Net: $123.45", "Subtotal: 123.45"
        let englishPatterns = [
            try! NSRegularExpression(pattern: "(?i)net[：: ]*\\$?\\s*(\\d+\\.?\\d*)", options: .caseInsensitive),
            try! NSRegularExpression(pattern: "(?i)subtotal[：: ]*\\$?\\s*(\\d+\\.?\\d*)", options: .caseInsensitive)
        ]
        
        // Chinese patterns: "净额: 123.45", "小计: 123.45"
        let chinesePatterns = [
            try! NSRegularExpression(pattern: "净额[：: ]*[￥$]?\\s*(\\d+\\.?\\d*)", options: []),
            try! NSRegularExpression(pattern: "小计[：: ]*[￥$]?\\s*(\\d+\\.?\\d*)", options: [])
        ]
        
        // Try English patterns
        for pattern in englishPatterns {
            if let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let amountRange = Range(match.range(at: 1), in: text) {
                return Float(String(text[amountRange]))
            }
        }
        
        // Try Chinese patterns
        for pattern in chinesePatterns {
            if let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let amountRange = Range(match.range(at: 1), in: text) {
                return Float(String(text[amountRange]))
            }
        }
        
        return nil
    }
    
    /**
     * Extract date from text using various date format patterns
     */
    private func extractDate(text: String) -> String? {
        // Common date patterns: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.
        let datePatterns = [
            try! NSRegularExpression(pattern: "(\\d{4})[-\\./](\\d{1,2})[-\\./](\\d{1,2})", options: []),
            try! NSRegularExpression(pattern: "(\\d{1,2})[-\\./](\\d{1,2})[-\\./](\\d{4})", options: [])
        ]
        
        for pattern in datePatterns {
            if let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let dateRange = Range(match.range, in: text) {
                return String(text[dateRange])
            }
        }
        
        return nil
    }
    
    /**
     * Extract time from text using time format patterns
     */
    private func extractTime(text: String) -> String? {
        // Time patterns: HH:MM, HH:MM:SS
        let timePattern = try! NSRegularExpression(pattern: "(\\d{1,2}):(\\d{2})(?::(\\d{2}))?", options: [])
        
        if let match = timePattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let timeRange = Range(match.range, in: text) {
            return String(text[timeRange])
        }
        
        return nil
    }
    
    /**
     * Extract total items count - count item lines or find "Items" label
     */
    private func extractTotalItems(results: [OcrResult]) -> Int? {
        let allText = results.map { $0.text }.joined(separator: "\n")
        
        // Try to find "Items" label with count
        let itemsPattern = try! NSRegularExpression(pattern: "(?i)(?:items?|商品|品项)[：: ]*(\\d+)", options: .caseInsensitive)
        
        if let match = itemsPattern.firstMatch(in: allText, range: NSRange(allText.startIndex..., in: allText)),
           let countRange = Range(match.range(at: 1), in: allText) {
            return Int(String(allText[countRange]))
        }
        
        // Fallback: count lines that look like items (contain numbers and likely item names)
        let itemLines = results.filter { $0.text.contains(where: { $0.isNumber }) && $0.text.count > 5 }.count
        
        return itemLines > 0 ? itemLines : nil
    }
    
    // MARK: - Image Preprocessing Helper Methods
    
    /**
     * Preprocess image for CLS model input
     * Resizes to CLS_INPUT_SIZE and normalizes pixel values
     */
    private func preprocessImageForCls(image: UIImage) throws -> ORTValue {
        // TODO: Implement proper image preprocessing for CLS model
        // Resize image, normalize pixels, create ORTValue tensor
        throw NSError(domain: "OcrReceiptScanner", code: -5, userInfo: [NSLocalizedDescriptionKey: "Not implemented"])
    }
    
    /**
     * Preprocess image for detection model input
     * Handles variable aspect ratio by padding and scaling
     */
    private func preprocessImageForDetection(image: UIImage) throws -> (ORTValue, Float) {
        // TODO: Implement proper image preprocessing for detection model
        // Resize image, normalize pixels, create ORTValue tensor, calculate scale
        throw NSError(domain: "OcrReceiptScanner", code: -5, userInfo: [NSLocalizedDescriptionKey: "Not implemented"])
    }
    
    /**
     * Preprocess cropped text region for recognition model input
     */
    private func preprocessImageForRecognition(image: UIImage) throws -> ORTValue {
        // TODO: Implement proper image preprocessing for recognition model
        // Resize image, normalize pixels, create ORTValue tensor
        throw NSError(domain: "OcrReceiptScanner", code: -5, userInfo: [NSLocalizedDescriptionKey: "Not implemented"])
    }
    
    /**
     * Postprocess detection output to extract bounding boxes
     */
    private func postprocessDetection(output: ORTValue, scale: Float, originalWidth: Int, originalHeight: Int) throws -> [TextBox] {
        // TODO: Implement proper DB (Differentiable Binarization) postprocessing
        return []
    }
    
    /**
     * Decode recognition model output using CTC (Connectionist Temporal Classification) decoding
     * 
     * CTC decoding rules:
     * 1. Greedy selection: Take argmax at each timestep
     * 2. Remove blanks: Skip index 0 (BLANK token)
     * 3. Collapse repeats: Skip if same index as previous timestep
     * 
     * @param output Recognition model output logits [T, C] where T=timesteps, C=num_classes
     * @return Decoded text string
     */
    private func decodeRecognitionOutput(output: ORTValue) -> String {
        // Extract tensor data from ORTValue
        // Note: This is a simplified implementation - actual implementation depends on ORTValue API
        // For now, we'll assume we can extract the float array from the tensor
        
        // TODO: Extract actual tensor data from ORTValue based on ONNX Runtime iOS API
        // The output shape should be [T, C] where T is timesteps and C is num_classes
        // For now, this is a placeholder that shows the CTC decoding logic
        
        guard !charDict.isEmpty else {
            print("Character dictionary is empty")
            return ""
        }
        
        // Placeholder: In real implementation, extract 2D array from ORTValue
        // let logits: [[Float]] = extractLogitsFromORTValue(output)
        
        // For demonstration, showing the CTC decoding algorithm structure
        var result = ""
        var prevIndex = -1 // Track previous index to collapse repeats
        
        // This would iterate through timesteps in real implementation
        // for t in 0..<numTimesteps {
        //     // Rule 1: Greedy selection - find index with maximum probability
        //     var maxIndex = 0
        //     var maxValue = logits[t][0]
        //     
        //     for c in 1..<numClasses {
        //         if logits[t][c] > maxValue {
        //             maxValue = logits[t][c]
        //             maxIndex = c
        //         }
        //     }
        //     
        //     let currentIndex = maxIndex
        //     
        //     // Rule 2: Skip blank token (index 0)
        //     if currentIndex == CTC_BLANK_INDEX {
        //         prevIndex = currentIndex
        //         continue
        //     }
        //     
        //     // Rule 3: Collapse repeats - skip if same as previous index
        //     if currentIndex == prevIndex {
        //         continue
        //     }
        //     
        //     // Append character from dictionary
        //     if currentIndex < charDict.count {
        //         result.append(charDict[currentIndex])
        //     }
        //     
        //     prevIndex = currentIndex
        // }
        
        // Actual implementation would extract data from ORTValue and perform decoding
        // For now, return empty string as placeholder
        return result
    }
    
    /**
     * Helper function to perform CTC decoding on logits array
     * This is the actual decoding logic that can be called once logits are extracted
     */
    private func performCTCDecoding(logits: [[Float]], numTimesteps: Int, numClasses: Int) -> String {
        guard !charDict.isEmpty && charDict.count >= numClasses else {
            print("Character dictionary size (\(charDict.count)) < model output classes (\(numClasses))")
            return ""
        }
        
        var result = ""
        var prevIndex = -1 // Track previous index to collapse repeats
        
        // Iterate through each timestep
        for t in 0..<numTimesteps {
            // Rule 1: Greedy selection - find index with maximum probability
            var maxIndex = 0
            var maxValue = logits[t][0]
            
            for c in 1..<numClasses {
                if logits[t][c] > maxValue {
                    maxValue = logits[t][c]
                    maxIndex = c
                }
            }
            
            let currentIndex = maxIndex
            
            // Rule 2: Skip blank token (index 0) - do NOT update prevIndex here
            // This allows repeated characters separated by blanks to be correctly decoded
            if currentIndex == CTC_BLANK_INDEX {
                continue
            }
            
            // Rule 3: Collapse repeats - skip if same as previous index
            if currentIndex == prevIndex {
                continue
            }
            
            // Append character from dictionary
            if currentIndex < charDict.count {
                result.append(charDict[currentIndex])
            } else {
                print("Index \(currentIndex) out of bounds for dictionary size \(charDict.count)")
            }
            
            // Only update prevIndex after successfully appending a character
            prevIndex = currentIndex
        }
        
        return result
    }
    
    /**
     * Crop text region from image using bounding box coordinates
     */
    private func cropTextRegion(image: UIImage, box: TextBox) -> UIImage {
        // TODO: Implement proper cropping with perspective transformation if needed
        return image
    }
    
    /**
     * Rotate image by specified angle in degrees
     */
    private func rotateImage(image: UIImage, degrees: CGFloat) -> UIImage {
        // TODO: Implement proper image rotation
        return image
    }
    
    /**
     * Create dictionary from ReceiptData for React Native bridge
     */
    private func createReceiptDataDict(data: ReceiptData) -> [String: Any] {
        return [
            "receiptNumber": data.receiptNumber as Any,
            "totalItems": data.totalItems ?? -1,
            "grossAmount": data.grossAmount ?? -1.0,
            "netAmount": data.netAmount ?? -1.0,
            "date": data.date as Any,
            "time": data.time as Any,
            "shopName": data.shopName as Any
        ]
    }
    
    // MARK: - Data Structures
    
    /**
     * Represents a bounding box for a detected text region
     */
    private struct TextBox {
        let x1: Int
        let y1: Int
        let x2: Int
        let y2: Int
        let score: Float
    }
    
    /**
     * Represents OCR result with recognized text and bounding box
     */
    private struct OcrResult {
        let text: String
        let box: TextBox
    }
    
    /**
     * Represents structured receipt data extracted from OCR results
     */
    private struct ReceiptData {
        let receiptNumber: String?
        let totalItems: Int?
        let grossAmount: Float?
        let netAmount: Float?
        let date: String?
        let time: String?
        let shopName: String?
    }
    
    override func supportedEvents() -> [String]! {
        return []
    }
}

