import { Box } from './Box.interface';

export interface OcrResult {
  box: Box;
  text: string;
  confidence: number;
}

