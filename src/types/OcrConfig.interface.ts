import { FileSystemAdapter } from './FileSystemAdapter.interface';
import { OnnxRuntime } from './OnnxRuntime.interface';

export interface OcrConfig {
  runtime: OnnxRuntime;
  detModelPath: string | number;
  recModelPath: string | number;
  characterDict: string[];
  characterDictPath?: string;
  fileSystemAdapter?: FileSystemAdapter;
}

