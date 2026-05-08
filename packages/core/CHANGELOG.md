# Changelog

## [0.3.3](https://github.com/timothyjordan/a14y/compare/core-v0.3.2...core-v0.3.3) (2026-05-08)


### Bug Fixes

* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))

## [0.3.2](https://github.com/timothyjordan/a14y/compare/core-v0.3.1...core-v0.3.2) (2026-05-06)


### Bug Fixes

* stop crawler discovering phantom URLs from .md mirrors

## [0.3.1](https://github.com/timothyjordan/a14y/compare/core-v0.3.0...core-v0.3.1) (2026-04-30)


### Features

* **core:** seed-loading progress events (TJ-235)
* **docs:** a14y.dev landing redesign + manual light/dark toggle


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240)
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234)
* **core:** per-request timeout in httpClient (TJ-233)
