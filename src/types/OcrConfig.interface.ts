import { FileSystemAdapter } from './FileSystemAdapter.interface';
import { OnnxRuntime } from './OnnxRuntime.interface';

export interface OcrConfig {
  runtime: OnnxRuntime;
  detModelPath: string | number; // number is require() result, will be converted to string
  recModelPath: string | number; // number is require() result, will be converted to string
  characterDict: string[];
  characterDictPath?: string;
  fileSystemAdapter?: FileSystemAdapter;
}

