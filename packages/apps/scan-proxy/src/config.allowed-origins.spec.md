# Spec: CORS allow-list resolution (`config.ts`)

Intent source: TJ-928 ("Make scan-proxy CORS allow-list env-configurable for
local dev"), the `config.ts` docstrings, and the proxy's CORS contract in
`handler.ts`. Oracle is the intended behavior below, NOT the implementation.

## `parseExtraOrigins(raw: string | undefined): string[]`

Parses the operator-supplied `PROXY_EXTRA_ORIGINS` value into a clean list of
origin strings.

Claims:
- `undefined` yields `[]`.
- `''` (empty string) yields `[]`.
- A single origin `'http://localhost:4330'` yields `['http://localhost:4330']`.
- Comma-separated origins are each returned in order:
  `'http://a.test,http://b.test'` yields `['http://a.test', 'http://b.test']`.
- Surrounding whitespace on each entry is trimmed:
  `' http://a.test , http://b.test '` yields `['http://a.test', 'http://b.test']`.
- Empty entries produced by stray/trailing/leading/doubled commas are dropped:
  `'http://a.test,,'` yields `['http://a.test']`; `',,'` yields `[]`.
- The function does not validate or normalize origin syntax; a non-URL token
  like `'garbage'` is returned as-is (`['garbage']`). Validation is out of scope.
- It is pure: it does not read `process.env` and does not mutate its argument.

## `resolveAllowedOrigins(env?): readonly string[]`

Computes the effective CORS allow-list for an environment.

Claims:
- With no argument, or an env object lacking `PROXY_EXTRA_ORIGINS`, the result
  equals `ALLOWED_ORIGINS` exactly (same entries; production parity). This is
  the security-critical default: absent opt-in, nothing extra is allowed.
- Every origin in the hardcoded `ALLOWED_ORIGINS` is always present in the
  result.
- When `PROXY_EXTRA_ORIGINS` is set, each parsed extra origin is included in
  addition to the hardcoded list.
- The result is de-duplicated: an extra origin equal to a hardcoded one (e.g.
  `'https://a14y.dev'`) does not appear twice; and repeated extras collapse to
  one.
- Only the `PROXY_EXTRA_ORIGINS` key is consulted; other env keys are ignored.

## Handler integration (`handleProxy`, CORS echo)

The proxy echoes `access-control-allow-origin: <origin>` only when the request
`Origin` is on the effective allow-list.

Claims:
- Default deps (no `allowedOrigins`): a request whose `Origin` is in
  `ALLOWED_ORIGINS` (e.g. `https://a14y.dev`) gets that value echoed back in
  `access-control-allow-origin`.
- Default deps: a request whose `Origin` is NOT hardcoded (e.g.
  `http://localhost:4330`) gets NO `access-control-allow-origin` header.
- When `deps.allowedOrigins` includes that previously-rejected origin, the same
  request now gets it echoed in `access-control-allow-origin`.
- Allow-listing is exact-match on the full origin string (scheme + host + port);
  a port that is not listed is not allowed.
