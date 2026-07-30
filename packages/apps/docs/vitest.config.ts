import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // test/site-routes.adversarial.test.ts proves the unregistered-route
    // guard by briefly writing a probe page into src/pages/. That is
    // shared state: a suite running in a parallel worker would read the
    // probe and fail. The whole suite takes a few seconds, so serialising
    // files costs little and removes the race outright.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
