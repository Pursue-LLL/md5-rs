# Rollup Plugin ESMWASM

Add WebAssembly ESM integration (aka. Webpack's asyncWebAssembly) to Rollup and support wasm-pack generated modules.

## Installation

``` shell
npm install rollup-plugin-esmwasm
```

## usage

```javascript
import wasmBundlerPlugin from 'rollup-plugin-esmwasm';

export default {
  plugins: [
    wasmBundlerPlugin({
      targetEnv: 'node',
    }),
  ],
};
```

## Options

### maxFileSize
Type: Number

Default: 14336 (14kb)

The maximum file size for inline files. If a file exceeds this limit, it will be copied to the destination folder and loaded from a separate file at runtime. If maxFileSize is set to 0 all files will be copied.

Files specified in sync to load synchronously are always inlined, regardless of size.


### targetEnv

Type: "browser" | "node"
Default: "node"

Configures what code is emitted to instantiate the Wasm (both inline and separate):

"browser" is used in the browser environment, and fetch is used to load the wasm module.

"node" for node environment, use the inline wasm module directly with base64
