import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Create a base64 data URI for a wasm file
 */
const createBase64UriForWasm = async (filePath) => {
  try {
    const base64 = await fs.promises.readFile(filePath, 'base64');
    return `data:application/wasm;base64,${base64}`;
  } catch (error) {
    throw new Error(`Failed to read WASM file: ${error.message}`);
  }
};

/**
 * Parse import and export information from a wasm file
 */
const parseWasm = async (wasmFilePath) => {
  try {
    // Return a byte array buffer
    const wasmBinary = await fs.promises.readFile(wasmFilePath);
    // Return a Promise that resolves to a WebAssembly.Module object
    const wasmModule = await WebAssembly.compile(wasmBinary);

    // Use Map to optimize the collection of import items
    const importMap = new Map();
    WebAssembly.Module.imports(wasmModule).forEach(({ module, name }) => {
      if (!importMap.has(module)) {
        importMap.set(module, []);
      }
      importMap.get(module).push(name);
    });

    /**
     * @example
     * [
     *  {
     *    from: "env",
     *    names: ["log", "globalVar"]
     *  },
     *  {
     *    from: "js",
     *    names: ["print"]
     *  }
     * ]
     */
    const imports = Array.from(importMap.entries()).map(([from, names]) => ({ from, names }));
    const exports = WebAssembly.Module.exports(wasmModule).map(({ name }) => name);

    return { imports, exports };
  } catch (error) {
    throw new Error(`Failed to parse WASM file: ${error.message}`);
  }
};

/**
 * Generate WASM initialization code
 */
const generateWasmInitCode = (imports, exports, wasmUrl) => `
  const initWasm = async (imports = {}, wasmUrl) => {
    try {
      const instance = await (async () => {
        if (wasmUrl.startsWith('data:')) {
          const base64Content = wasmUrl.replace(/^data:.*?base64,/, '');

          // Decode base64
          const bytes = (() => {
            if (typeof Buffer === "function" && typeof Buffer.from === "function") {
              return Buffer.from(base64Content, "base64");
            }
            if (typeof atob === "function") {
              const binaryString = atob(base64Content);
              return Uint8Array.from(binaryString, char => char.charCodeAt(0));
            }
            throw new Error("No available base64 decoder");
          })();

          const result = await WebAssembly.instantiate(bytes, imports);
          return result.instance;
        }

        // Load from URL
        const response = await fetch(wasmUrl);
        const contentType = response.headers.get("Content-Type") || "";

        if ("instantiateStreaming" in WebAssembly &&
            contentType.startsWith("application/wasm")) {
          const result = await WebAssembly.instantiateStreaming(response, imports);
          return result.instance;
        }

        const buffer = await response.arrayBuffer();
        const result = await WebAssembly.instantiate(buffer, imports);
        return result.instance;
      })();

      return instance.exports;
    } catch (error) {
      throw new Error(\`WASM initialization failed: \${error.message}\`);
    }
  };

  // Import dependency modules
  ${imports.map((imp, i) => `import * as import${i} from '${imp.from}';`).join('\n')}

  // Initialize WASM module, passing in external imports
  const wasmModule = await initWasm({
    ${imports.map((imp, i) => `'${imp.from}': { ${imp.names.map((name) => `'${name}': import${i}.${name}`).join(', ')} }`).join(',\n')}
  }, '${wasmUrl}');

  // Export WASM functions
  ${exports.map((name) => `export const ${name} = wasmModule.${name};`).join('\n')}
`;

/**
 * Rollup WASM plugin
 * @param {Object} options Plugin configuration options
 * @param {number} [options.maxFileSize=14336] - Maximum size for inline files (in bytes)
 */
export default function wasmPlugin(options = {}) {
  const {
    maxFileSize = 14336,
    targetEnv = 'node',
  } = options;

  if (targetEnv !== 'node' && targetEnv !== 'browser') {
    throw new Error('targetEnv must be node or browser');
  }

  if (typeof maxFileSize !== 'number' || maxFileSize < 0) {
    throw new Error('maxFileSize must be a non-negative number');
  }

  return {
    name: 'rollup-plugin-wasm',

    async resolveId(source, importer) {
      if (!source.endsWith('.wasm')) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (resolved) {
        // Generate a unique output path for large files
        const stats = fs.statSync(resolved.id);
        if (maxFileSize > 0 && stats.size > maxFileSize) {
          const hash = crypto.createHash('md5')
            .update(resolved.id)
            .digest('hex')
            .slice(0, 8);
          const fileName = `${path.basename(resolved.id, '.wasm')}-${hash}.wasm`;
          resolved.meta = {
            ...resolved.meta,
            wasmPath: fileName,
          };
        }
      }
      return resolved?.id;
    },

    async load(id) {
      if (!id.endsWith('.wasm')) return null;

      try {
        const stats = fs.statSync(id);
        // Inline if the file is small or not in a browser environment
        const shouldInline = (maxFileSize === 0 ? false : stats.size <= maxFileSize) || targetEnv === 'node';

        const [{ imports, exports }, wasmUrl] = await Promise.all([
          parseWasm(id),
          shouldInline ? createBase64UriForWasm(id) : null,
        ]);

        // If the file is large and in a browser environment, use fetch to load
        if (!shouldInline) {
          const resolved = await this.resolve(id);
          const fileName = resolved.meta?.wasmPath || path.basename(id);
          this.emitFile({
            type: 'asset',
            fileName,
            source: await fs.promises.readFile(id),
          });
          return generateWasmInitCode(imports, exports, fileName);
        }

        return generateWasmInitCode(imports, exports, wasmUrl);
      } catch (error) {
        this.error(`Failed to load WASM: ${error.message}`);
      }
    },
  };
}
