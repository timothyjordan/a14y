import { defineConfig } from 'astro/config';
import { assertCoverageIntegration } from './src/lib/assert-coverage';
import { markdownMirrorsIntegration } from './src/integrations/markdown-mirrors';
import { discoveryFilesIntegration } from './src/integrations/discovery-files';

// Astro config for the a14y documentation site.
//
// Served from the custom domain a14y.dev (GitHub Pages picks up the
// CNAME in public/). The content-coverage integration runs at
// `astro:build:start`, so any check id shipped in a frozen scorecard
// manifest that lacks a corresponding markdown file will fail the
// build loudly — matching the runtime guarantee in @a14y/core's
// getScorecard().
export default defineConfig({
  site: 'https://a14y.dev',
  output: 'static',
  trailingSlash: 'always',
  build: {
    // Astro inlines small stylesheets into <head> by default. Our
    // global.css is ~3.5 KB which is "small" but it bloats the
    // body/html ratio a14y uses for html.text-ratio (the
    // landing page measured 11.5%, well below the 15% threshold,
    // because the inlined <style> block dominated the HTML byte
    // count). Forcing external stylesheets keeps the head lean.
    inlineStylesheets: 'never',
  },
  markdown: {
    shikiConfig: {
      // Shiki by default emits <pre class="astro-code …" data-language="ts">
      // which is fine for syntax highlighting but doesn't carry the
      // class="language-*" attribute that a14y's
      // code.language-tags check looks for. This transformer just
      // appends the missing class to <pre> so both conventions are
      // satisfied without disturbing the existing astro-code class
      // or the data-language attribute.
      transformers: [
        {
          pre(node) {
            const lang = (this as { options: { lang?: string } }).options.lang;
            if (!lang) return;
            const existing =
              typeof node.properties.class === 'string'
                ? node.properties.class
                : '';
            node.properties.class = `${existing} language-${lang}`.trim();
          },
        },
      ],
    },
  },
  integrations: [
    assertCoverageIntegration(),
    markdownMirrorsIntegration(),
    discoveryFilesIntegration(),
  ],
});
