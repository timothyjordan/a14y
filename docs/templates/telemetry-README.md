# @a14y/telemetry

Anonymous, opt-out telemetry shim shared by the [a14y](https://github.com/timothyjordan/a14y) CLI and Chrome extension. Provider-agnostic core with a built-in GA4 Measurement Protocol adapter; runtime helpers ship behind subpath exports so consumers don't pay for code paths they don't use.

<!-- include: fragments/_links.md -->

## Install

```bash
npm install @a14y/telemetry
```

## Usage

The runtime-agnostic core lives at the package root; runtime adapters live behind subpath exports:

```ts
import { init, track, setEnabled } from '@a14y/telemetry';
import { createNodeRuntime } from '@a14y/telemetry/node';
// or for a Chrome extension:
// import { createChromeExtRuntime } from '@a14y/telemetry/chrome-ext';

init({
  app: 'a14y-cli',
  adapter: /* a GA4 adapter, the no-op adapter, or your own */,
  runtime: createNodeRuntime(),
});

track('cli_invocation', { mode: 'site' });
```

A no-op adapter (`noopAdapter`) and a GA4 Measurement Protocol adapter (`createGa4MpAdapter`) are exported from the package root. Bring-your-own adapters implement the `Adapter` interface from `@a14y/telemetry`.

Users opt out via `--no-telemetry` on the CLI, the Privacy toggle in the extension popup, or the on/off control on `https://a14y.dev/privacy/`. The shim never sends URLs or page content — only check IDs, pass/fail counts, bucketed durations, and a per-run UUID.

<!-- include: fragments/_license.md -->
