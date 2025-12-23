/**
 * Type for the onnxruntime-react-native module
 * When imported as `await import('onnxruntime-react-native')` or `import * as ort`,
 * this accepts the actual module structure
 */
export type OnnxRuntime = typeof import('onnxruntime-react-native') extends infer T
  ? T extends { default: infer D }
    ? D extends { InferenceSession: any; Tensor: any }
      ? D
      : T extends { InferenceSession: any; Tensor: any }
      ? T
      : any
    : T extends { InferenceSession: any; Tensor: any }
    ? T
    : any
  : any;


