declare module 'onnxruntime-react-native' {
  export class Tensor<T extends Tensor.TypeMap[K], K extends keyof Tensor.TypeMap = keyof Tensor.TypeMap> {
    constructor(type: K, data: T, dims: readonly number[]);
    data: T;
    dims: readonly number[];
  }

  export namespace Tensor {
    export interface TypeMap {
      float32: Float32Array;
      int32: Int32Array;
      int64: BigInt64Array;
      uint8: Uint8Array;
    }
  }

  export class InferenceSession {
    static create(modelPath: string | number): Promise<InferenceSession>;
    inputNames: readonly string[];
    outputNames: readonly string[];
    run(feeds: Record<string, Tensor<Tensor.TypeMap[keyof Tensor.TypeMap], keyof Tensor.TypeMap>>): Promise<Record<string, Tensor<Tensor.TypeMap[keyof Tensor.TypeMap], keyof Tensor.TypeMap>>>;
  }
}

