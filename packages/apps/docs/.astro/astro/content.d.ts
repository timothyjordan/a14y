declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"checks": {
"agents-md.exists.md": {
	id: "agents-md.exists.md";
  slug: "agents-mdexists";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"agents-md.has-min-sections.md": {
	id: "agents-md.has-min-sections.md";
  slug: "agents-mdhas-min-sections";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"api.schema-link.md": {
	id: "api.schema-link.md";
  slug: "apischema-link";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"code.language-tags.md": {
	id: "code.language-tags.md";
  slug: "codelanguage-tags";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"discovery.indexed.md": {
	id: "discovery.indexed.md";
  slug: "discoveryindexed";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.canonical-link.md": {
	id: "html.canonical-link.md";
  slug: "htmlcanonical-link";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.glossary-link.md": {
	id: "html.glossary-link.md";
  slug: "htmlglossary-link";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.headings.md": {
	id: "html.headings.md";
  slug: "htmlheadings";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.json-ld.breadcrumb.md": {
	id: "html.json-ld.breadcrumb.md";
  slug: "htmljson-ldbreadcrumb";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.json-ld.date-modified.md": {
	id: "html.json-ld.date-modified.md";
  slug: "htmljson-lddate-modified";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.json-ld.md": {
	id: "html.json-ld.md";
  slug: "htmljson-ld";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.lang-attribute.md": {
	id: "html.lang-attribute.md";
  slug: "htmllang-attribute";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.meta-description.md": {
	id: "html.meta-description.md";
  slug: "htmlmeta-description";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.og-description.md": {
	id: "html.og-description.md";
  slug: "htmlog-description";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.og-title.md": {
	id: "html.og-title.md";
  slug: "htmlog-title";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"html.text-ratio.md": {
	id: "html.text-ratio.md";
  slug: "htmltext-ratio";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"http.content-type-html.md": {
	id: "http.content-type-html.md";
  slug: "httpcontent-type-html";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"http.no-noindex-noai.md": {
	id: "http.no-noindex-noai.md";
  slug: "httpno-noindex-noai";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"http.redirect-chain.md": {
	id: "http.redirect-chain.md";
  slug: "httpredirect-chain";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"http.status-200.md": {
	id: "http.status-200.md";
  slug: "httpstatus-200";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"llms-txt.content-type.md": {
	id: "llms-txt.content-type.md";
  slug: "llms-txtcontent-type";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"llms-txt.exists.md": {
	id: "llms-txt.exists.md";
  slug: "llms-txtexists";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"llms-txt.md-extensions.md": {
	id: "llms-txt.md-extensions.md";
  slug: "llms-txtmd-extensions";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"llms-txt.non-empty.md": {
	id: "llms-txt.non-empty.md";
  slug: "llms-txtnon-empty";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"markdown.alternate-link.md": {
	id: "markdown.alternate-link.md";
  slug: "markdownalternate-link";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"markdown.canonical-header.md": {
	id: "markdown.canonical-header.md";
  slug: "markdowncanonical-header";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"markdown.content-negotiation.md": {
	id: "markdown.content-negotiation.md";
  slug: "markdowncontent-negotiation";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"markdown.frontmatter.md": {
	id: "markdown.frontmatter.md";
  slug: "markdownfrontmatter";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"markdown.mirror-suffix.md": {
	id: "markdown.mirror-suffix.md";
  slug: "markdownmirror-suffix";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"markdown.sitemap-section.md": {
	id: "markdown.sitemap-section.md";
  slug: "markdownsitemap-section";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"robots-txt.allows-ai-bots.md": {
	id: "robots-txt.allows-ai-bots.md";
  slug: "robots-txtallows-ai-bots";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"robots-txt.allows-llms-txt.md": {
	id: "robots-txt.allows-llms-txt.md";
  slug: "robots-txtallows-llms-txt";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"robots-txt.exists.md": {
	id: "robots-txt.exists.md";
  slug: "robots-txtexists";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"sitemap-md.exists.md": {
	id: "sitemap-md.exists.md";
  slug: "sitemap-mdexists";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"sitemap-md.has-structure.md": {
	id: "sitemap-md.has-structure.md";
  slug: "sitemap-mdhas-structure";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"sitemap-xml.exists.md": {
	id: "sitemap-xml.exists.md";
  slug: "sitemap-xmlexists";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"sitemap-xml.has-lastmod.md": {
	id: "sitemap-xml.has-lastmod.md";
  slug: "sitemap-xmlhas-lastmod";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
"sitemap-xml.valid.md": {
	id: "sitemap-xml.valid.md";
  slug: "sitemap-xmlvalid";
  body: string;
  collection: "checks";
  data: InferEntrySchema<"checks">
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = typeof import("../../src/content/config.js");
}
