import { NativeModules, Platform } from 'react-native';
import { ReceiptData, ImageInput } from './types/ReceiptData.interface';
import { normalizeImageInput, isValidImageUri, isBase64Image } from './utils/imageUtils';

const { OcrReceiptScanner } = NativeModules;

/**
 * Main class for OCR Receipt Scanner
 * Provides a simple API for scanning receipts and extracting structured data
 */
class OcrReceiptScannerClass {
  private initialized: boolean = false;

  /**
   * Initialize the OCR models
   * This must be called once before scanning receipts
   * Models are loaded asynchronously and cached for performance
   */
  async initialize(): Promise<void> {
    if (!OcrReceiptScanner) {
      throw new Error('OcrReceiptScanner native module is not available');
    }

    try {
      await OcrReceiptScanner.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize OCR models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Scan receipt from image and extract structured data
   * 
   * @param image - Image input as URI string, base64 string, or ImageSource object
   * @returns Promise resolving to ReceiptData with extracted receipt fields
   */
  async scanReceipt(image: ImageInput): Promise<ReceiptData> {
    if (!this.initialized) {
      throw new Error('OCR models not initialized. Call initialize() first.');
    }

    if (!OcrReceiptScanner) {
      throw new Error('OcrReceiptScanner native module is not available');
    }

    // Normalize image input to ImageSource format
    const imageSource = normalizeImageInput(image);
    let imageUri = imageSource.uri;

    // Validate image URI
    if (!isValidImageUri(imageUri)) {
      // If it's base64, we'll pass it directly (native should handle or user should convert)
      if (!isBase64Image(imageUri)) {
        throw new Error(`Invalid image URI: ${imageUri}`);
      }
    }

    try {
      // Note: Base64 and remote URLs should be handled by user before calling this function
      // For base64: convert to file URI using a file system library
      // For remote URLs: download first and provide local file URI

      // Call native module to scan receipt
      const result = await OcrReceiptScanner.scanReceipt(imageUri);

      // Convert native result to ReceiptData type
      return this.normalizeReceiptData(result);
    } catch (error) {
      throw new Error(`Failed to scan receipt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Normalize native module result to ReceiptData interface
   * Converts -1 values to null for optional fields
   */
  private normalizeReceiptData(result: {
    receiptNumber: string | null;
    totalItems: number;
    grossAmount: number;
    netAmount: number;
    date: string | null;
    time: string | null;
    shopName: string | null;
  }): ReceiptData {
    return {
      receiptNumber: result.receiptNumber,
      totalItems: result.totalItems === -1 ? null : result.totalItems,
      grossAmount: result.grossAmount === -1.0 ? null : result.grossAmount,
      netAmount: result.netAmount === -1.0 ? null : result.netAmount,
      date: result.date,
      time: result.time,
      shopName: result.shopName,
    };
  }

  /**
   * Check if OCR models are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
const ocrReceiptScanner = new OcrReceiptScannerClass();

/**
 * Initialize OCR models
 * Must be called before scanning receipts
 */
export async function initialize(): Promise<void> {
  return ocrReceiptScanner.initialize();
}

/**
 * Scan receipt from image
 * 
 * @param image - Image input as URI string, base64 string, or ImageSource object
 * @returns Promise resolving to ReceiptData with extracted receipt fields
 */
export async function scanReceipt(image: ImageInput): Promise<ReceiptData> {
  return ocrReceiptScanner.scanReceipt(image);
}

/**
 * Check if OCR models are initialized
 */
export function isInitialized(): boolean {
  return ocrReceiptScanner.isInitialized();
}

// Export default instance for advanced usage
export default ocrReceiptScanner;
