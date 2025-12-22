export interface ReceiptData {
  receiptNumber: string | null;
  totalItems: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  date: string | null;
  time: string | null;
  shopName: string | null;
  rawText?: string;
}

export interface OcrError {
  code: string;
  message: string;
  details?: string;
}

export interface ImageSource {
  uri: string;
  width?: number;
  height?: number;
}

export type ImageInput = string | ImageSource;

