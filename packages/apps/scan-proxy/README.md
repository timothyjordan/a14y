# @a14y/scan-proxy

A tiny CORS proxy that lets the [a14y](https://a14y.dev) website run audits fully
client-side. The browser cannot fetch a target site's `robots.txt`, `sitemap.xml`,
`llms.txt`, `AGENTS.md`, or HTML cross-origin, so the homepage scan widget routes
those requests through this service, which adds the CORS headers the browser needs.

It is intentionally minimal: a single request handler, no runtime dependencies
(Node 20 globals only), built to run on **Google Cloud Run** with scale-to-zero so
idle cost is $0.

## How it works

`GET /?url=<encoded target>` fetches the target and relays it back. The contract
with the browser client (`createProxyFetch` in `@a14y/docs`):

- A **successful relay** always returns HTTP `200` and puts the real upstream
  status in the `x-a14y-status` header (even for upstream 404 / 500 / 3xx). The
  client rebuilds a `Response` from that header. This is deliberate: returning a
  real 3xx would make the browser either auto-follow it cross-origin (blocked) or
  hand back an unreadable `opaqueredirect`, breaking `@a14y/core`'s manual redirect
  handling. The envelope keeps that logic working unchanged.
- A **proxy-level error** (bad/blocked target, wrong method, rate limit, upstream
  failure, oversized body) returns a non-200 **without** `x-a14y-status`. The client
  treats the absence of that header as a hard failure to surface to the user.

`GET /healthz` returns `ok` for Cloud Run health checks.

### Safety guards

- **SSRF:** http(s) only; default ports only; rejects loopback / private /
  link-local / CGNAT IP literals, `*.local`, `*.internal`, and cloud-metadata
  hosts. (Deploy with **no VPC connector** so the service has no route to private
  networks even if a public name resolves inward.)
- **Body cap:** 5 MB per response (`MAX_BODY_BYTES`).
- **Timeout:** 30s per upstream request.
- **Rate limit:** per-IP token bucket (per instance).
- **CORS allow-list:** only `a14y.dev`, `baseline.a14y.dev`, and localhost dev ports.
- **Privacy:** target URLs are never logged.

Tunables live in `src/config.ts`.

## Local development

```bash
npm install          # from the repo root (workspaces)
cd packages/apps/scan-proxy
npm run dev          # tsx watch, listens on :8787
# or
npm run build && npm start
```

Point the docs app at it with `PUBLIC_SCAN_PROXY_URL=http://localhost:8787`.

Run the tests:

```bash
npm test
```

## Deploy to Cloud Run (manual)

Requires the project's `gcloud` account. From this directory:

```bash
gcloud run deploy a14y-scan-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=40 \
  --cpu=1 \
  --memory=256Mi \
  --timeout=35s \
  --no-vpc-connector
```

Then set `PUBLIC_SCAN_PROXY_URL` in the docs build to the printed service URL
(repo Settings > Secrets and variables > Actions > Variables).

### Automated deploy (GitHub Actions)

`.github/workflows/deploy-scan-proxy.yml` builds and deploys this service on
every push to `main` that touches `packages/apps/scan-proxy/**` (and on manual
dispatch), gated on the unit tests. It authenticates with Workload Identity
Federation (no stored key). One-time setup by a maintainer with GCP access:

1. Create a deployer service account and a Workload Identity Federation
   pool/provider bound to this repo.
2. Grant the deployer SA: `roles/run.admin`, `roles/cloudbuild.builds.editor`,
   `roles/artifactregistry.writer`, `roles/storage.admin`,
   `roles/iam.serviceAccountUser` (and allow unauthenticated invocation if org
   policy restricts it).
3. Add repo config: secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` and
   `GCP_SERVICE_ACCOUNT`; variables `GCP_PROJECT_ID` and optional `GCP_REGION`.

Until `GCP_PROJECT_ID` is set, the deploy job skips cleanly and manual deploy
(above) is the fallback.

### Cost controls (set these every deploy)

Cloud Run has no hard "stop at $X" switch, so cost is capped in layers:

1. **`--max-instances=5` (primary ceiling).** Compute is billed per instance-time;
   capping instances bounds spend deterministically even under an abuse spike;
   excess traffic queues/sheds instead of scaling cost up. `--min-instances=0`
   keeps idle cost at $0 (trade-off: occasional ~1–2s cold start).
2. **Per-IP rate limiting** (in the handler) blunts abuse before it scales instances.
3. **Billing budget + alerts.** Create a Cloud Billing budget (e.g. $5/mo) scoped to
   this service or the project with email alerts at 50% / 90% / 100%:
   ```bash
   gcloud billing budgets create \
     --billing-account=<ACCOUNT_ID> \
     --display-name="a14y scan-proxy" \
     --budget-amount=5USD \
     --threshold-rule=percent=0.5 \
     --threshold-rule=percent=0.9 \
     --threshold-rule=percent=1.0
   ```
4. **Optional hard auto-shutoff.** For a true cap, wire the budget to a Pub/Sub topic
   and a Cloud Function that disables billing or runs
   `gcloud run services update a14y-scan-proxy --max-instances=0` at 100%. See the
   GCP "[Disable billing to stop usage](https://cloud.google.com/billing/docs/how-to/notify#cap_disable_billing_to_stop_usage)"
   guide. The `--max-instances` ceiling already makes runaway spend very unlikely for
   this workload, so this is optional.
