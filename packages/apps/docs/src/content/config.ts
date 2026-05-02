import { defineCollection, z } from 'astro:content';

/**
 * Schema for the per-check authoring content. The id MUST match a stable
 * check id registered in @a14y/core; the build-time coverage
 * assertion in src/lib/assert-coverage.ts walks every shipped scorecard
 * and fails if any id is missing a content file.
 */
const checks = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    group: z.string(),
    scope: z.enum(['site', 'page']),
    why: z.string(),
    references: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
  }),
});

/**
 * Schema for the per-non-check-page authoring content. Each entry's
 * body is the canonical source for that page's content: it renders
 * to the HTML page via `<Content />` and to the matching `.md`
 * mirror via the markdown-mirrors integration. Inline HTML in the
 * body is preserved by Astro's markdown pipeline so design
 * components keep their classes; `{{TOKEN}}` placeholders are
 * resolved by the page-substitutions remark plugin (HTML pipeline)
 * and the same helper inside the mirror integration (markdown
 * pipeline).
 */
const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { checks, pages };
