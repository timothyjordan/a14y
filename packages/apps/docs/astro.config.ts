import { defineConfig } from 'astro/config';
import { assertCoverageIntegration } from './src/lib/assert-coverage';
import { markdownMirrorsIntegration } from './src/integrations/markdown-mirrors';

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
  build: {
    // Astro inlines small stylesheets into <head> by default. Our
    // global.css is ~3.5 KB which is "small" but it bloats the
    // body/html ratio agentready uses for html.text-ratio (the
    // landing page measured 11.5%, well below the 15% threshold,
    // because the inlined <style> block dominated the HTML byte
    // count). Forcing external stylesheets keeps the head lean.
    inlineStylesheets: 'never',
  },
  integrations: [assertCoverageIntegration(), markdownMirrorsIntegration()],
});
