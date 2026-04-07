import { defineCollection, z } from 'astro:content';

/**
 * Schema for the per-check authoring content. The id MUST match a stable
 * check id registered in @agentready/core; the build-time coverage
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

export const collections = { checks };
