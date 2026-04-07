import { defineConfig } from 'astro/config';
import { assertCoverageIntegration } from './src/lib/assert-coverage';

// Astro config for the agentready scorecard documentation site.
//
// `site` and `base` are configured for GitHub Pages serving from
// https://<owner>.github.io/agentready/. The custom integration runs the
// content-coverage assertion at `astro:build:start`, so any check id
// shipped in a frozen scorecard manifest that lacks a corresponding
// markdown file will fail the build loudly — matching the runtime
// guarantee in @agentready/core's getScorecard().
export default defineConfig({
  site: 'https://timothyjordan.github.io',
  base: '/agentready',
  output: 'static',
  trailingSlash: 'always',
  integrations: [assertCoverageIntegration()],
});
