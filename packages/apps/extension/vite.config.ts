import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    // @agentready/core is a CJS workspace package (the CLI consumes it via
    // `node dist/index.js`). Tell rollup to detect its named exports so we
    // can `import { validate } from '@agentready/core'` from the service
    // worker without bundling a separate ESM build of core.
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/@agentready\/core/, /node_modules/],
    },
    rollupOptions: {
      input: {
        results: 'src/results.html',
        options: 'src/options.html',
      },
    },
  },
  optimizeDeps: {
    include: ['@agentready/core'],
  },
});
