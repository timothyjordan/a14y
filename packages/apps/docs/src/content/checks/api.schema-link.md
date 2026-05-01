---
id: api.schema-link
title: API pages link to a machine-readable schema
group: API
scope: page
why: >
  Agents writing client code against your API need the schema, not prose. A link from
  your API reference page to an openapi.json (or swagger / schema.json) lets them generate
  request signatures, response types, and example calls without scraping your tables.
references:
  - title: "OpenAPI spec"
    url: https://spec.openapis.org/oas/latest.html
---

## How the check decides

The check first inspects the page URL path. If the path does NOT contain `/api`, `/reference`, `/endpoints`, `/swagger`, or `/openapi` (case-insensitive), the check returns N/A, it only applies to pages that look like API documentation.

If the path DOES match, the check enumerates every `<a>` element on the page and asserts at least one `href` ends in `openapi.json`, `swagger.json`, `swagger.yaml`, or `schema.json`. Fails if no such link exists.

## How to implement it

On every API reference page, include a "Download OpenAPI schema" link (or equivalent) pointing at your published OpenAPI / Swagger document. A sidebar link or a header button that every API page inherits is the easiest pattern.

### Pass

```html
<!-- /api/users/ -->
<nav>
  <a href="/api/openapi.json">Download OpenAPI schema</a>
</nav>
```

### Fail

```html
<!-- /api/users/ -->
<p>No schema link on this page.</p>
```
