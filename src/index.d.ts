import { Plugin } from 'rollup';

interface WasmPluginOptions {
  /**
   * Maximum size for inline files (in bytes).
   * If a file exceeds this limit, it will be copied to the destination folder and loaded from a separate file at runtime.
   * If maxFileSize is set to 0 all files will be copied.
   * @default 14336 (14kb)
   */
  maxFileSize?: number;

  /**
   * Target environment for the generated code.
   * - `node`: Use base64 encoding for all wasm files.
   * - `browser`: Use `fetch` to load wasm files that exceed `maxFileSize`.
   * @default 'node'
   */
  targetEnv?: 'node' | 'browser';
}

/**
 * A Rollup plugin that handles WebAssembly (WASM) files.
 * It allows importing .wasm files directly into your JavaScript code.
 * Small WASM files can be inlined as base64-encoded data URIs.
 * Larger files can be copied to the output directory and loaded at runtime using `fetch` (in the browser) or from the file system (in Node.js).
 */
export default function wasmPlugin(options?: WasmPluginOptions): Plugin;
