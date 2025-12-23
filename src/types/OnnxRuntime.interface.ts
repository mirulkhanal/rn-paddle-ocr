export interface OnnxTensor {
  dims: number[];
  data: Float32Array | Uint8Array | Int32Array | BigInt64Array;
}

export interface OnnxInferenceSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, OnnxTensor>): Promise<Record<string, OnnxTensor>>;
}

export interface OnnxRuntime {
  InferenceSession: {
    create(modelPath: string | number | Uint8Array): Promise<OnnxInferenceSession>;
  };
  Tensor: new (dataType: string, data: Float32Array, dims: number[]) => OnnxTensor;
}


