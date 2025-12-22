declare module 'buffer' {
  export const Buffer: {
    from(data: string, encoding: 'base64' | 'utf8'): {
      readonly [Symbol.toStringTag]: string;
      readonly length: number;
      [index: number]: number;
      subarray(start?: number, end?: number): Uint8Array;
    };
  };
}

