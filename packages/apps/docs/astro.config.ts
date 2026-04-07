import { defineConfig } from 'astro/config';
// The assertCoverageIntegration is imported and tested by vitest in
// test/coverage.test.ts. It is wired into `integrations` below in the
// content-authoring commit (TJ-123) once all 38 markdown files exist —
// in the scaffold commit it would correctly fail the build because no
// content is present yet.
// import { assertCoverageIntegration } from './src/lib/assert-coverage';

// Astro config for the agentready scorecard documentation site.
//
// `site` and `base` are configured for GitHub Pages serving from
// https://<owner>.github.io/agentready/.
export default defineConfig({
  site: 'https://timothyjordan.github.io',
  base: '/agentready',
  output: 'static',
  trailingSlash: 'always',
  integrations: [],
});
