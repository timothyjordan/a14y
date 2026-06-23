# sanitizeProps

> Strip PII-shaped keys, coerce values to GA4-compatible primitives, enforce
> GA4 length limits. Drops anything it can't safely send.

Takes an arbitrary `Record<string, unknown>` of event properties and returns a
`Record<string, EventParamValue>` that is safe to send to GA4. The function is a
privacy boundary: a key that looks like it carries personal or identifying data
must never appear in the output.

## Should

- Drop any key whose name carries an IP-address token. The token "ip" counts
  when it stands alone or is delimited by non-alphanumeric separators, in any
  case. This includes `ip`, `IP`, `client_ip`, `ip_address`, and `remote_ip`.
  (An IP address is personal data under GDPR, so leaking it is a privacy defect.)
- Keep keys that merely contain the letters "ip" inside a larger word, since they
  are not IP fields: for example `description`, `shipping_mode`, `tooltip`, and
  `recipe_id` must survive.
- Drop keys that look like other PII: names containing `url`, `href`, `host`, or
  `email`, including compound forms such as `page_url` and `user_email`.
- Drop path-shaped keys (a `path` token delimited by start/end or underscores,
  e.g. `path`, `file_path`, `path_segment`) except the allowlisted
  `path_category`, which is kept.
- Coerce values to GA4-compatible primitives: booleans and finite numbers pass
  through unchanged; strings pass through truncated to at most 100 characters.
- Drop entries whose value is `null` or `undefined`, a non-finite number
  (`NaN`, `Infinity`, `-Infinity`), or any non-primitive (objects, arrays,
  functions, symbols).
- Drop keys with an empty name or a name longer than 40 characters.
- Emit at most 25 parameters; ignore the rest once the cap is reached.

## Acceptance criteria

- `sanitizeProps({ client_ip: '203.0.113.7' })`, `{ ip_address: '...' }`,
  `{ remote_ip: '...' }`, `{ ip: '...' }`, and `{ IP: '...' }` all return `{}`.
- `sanitizeProps({ description: 'x', shipping_mode: 'air', tooltip: 't', recipe_id: 9 })`
  returns all four keys unchanged.
- `sanitizeProps({ page_url: 'x', user_email: 'y' })` returns `{}`.
- A 200-character string value is returned truncated to 100 characters.
- The function does not throw for ordinary valid inputs and does not mutate its
  argument.
