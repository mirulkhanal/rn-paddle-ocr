/**
 * Type declarations for .onnx files
 * Metro bundler handles these as assets, but TypeScript needs to know about them
 */
declare module '*.onnx' {
  const value: number; // React Native require() returns a number (module ID)
  export default value;
}

