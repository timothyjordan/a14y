import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    // @a14y/core is a CJS workspace package (the CLI consumes it via
    // `node dist/index.js`). Tell rollup to detect its named exports so we
    // can `import { validate } from '@a14y/core'` from the service
    // worker without bundling a separate ESM build of core.
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/@a14y\/core/, /node_modules/],
    },
    rollupOptions: {
      input: {
        results: 'src/results.html',
        options: 'src/options.html',
        offscreen: 'src/offscreen.html',
      },
    },
  },
  optimizeDeps: {
    include: ['@a14y/core'],
  },
});
