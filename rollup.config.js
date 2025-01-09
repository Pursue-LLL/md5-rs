import copy from 'rollup-plugin-copy';
import { swc, minify } from 'rollup-plugin-swc3';

export default {
  input: 'src/index.mjs',
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
    },
    {
      file: 'dist/index.js',
      format: 'esm',
    },
  ],
  plugins: [
    swc({
      jsc: {
        externalHelpers: false,
      },
    }),
    copy({
      targets: [
        { src: 'src/index.d.ts', dest: 'dist/types' },
      ],
      verbose: true, // 可选配置，用于在控制台输出详细信息
    }),
  ],
};


