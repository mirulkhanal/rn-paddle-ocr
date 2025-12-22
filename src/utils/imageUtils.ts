import { ImageInput, ImageSource } from '../types/ReceiptData.interface';

export function normalizeImageInput(input: ImageInput): ImageSource {
  if (typeof input === 'string') {
    return { uri: input };
  }
  return input;
}

export function isValidImageUri(uri: string): boolean {
  if (!uri || uri.trim().length === 0) {
    return false;
  }
  
  const validProtocols = ['file://', 'content://', 'asset://', 'http://', 'https://'];
  return validProtocols.some(protocol => uri.startsWith(protocol));
}

export function isBase64Image(data: string): boolean {
  const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|bmp|webp);base64,/i;
  return base64Pattern.test(data);
}

