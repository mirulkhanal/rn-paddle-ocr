import { FileSystemAdapter } from './FileSystemAdapter.interface';

export interface OcrConfig {
  detModelPath?: string | number;
  recModelPath?: string | number;
  characterDictPath?: string;
  characterDict?: string[];
  fileSystemAdapter?: FileSystemAdapter;
}

