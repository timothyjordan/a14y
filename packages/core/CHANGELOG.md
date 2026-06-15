# Changelog

## [0.3.22](https://github.com/timothyjordan/a14y/compare/core-v0.3.21...core-v0.3.22) (2026-06-15)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core,docs:** real detection for discovery.in-page-link (TJ-689) ([#68](https://github.com/timothyjordan/a14y/issues/68)) ([ae9b8de](https://github.com/timothyjordan/a14y/commit/ae9b8de6c53d3523e8ba611ebd9a33eec66effb7))
* **core,docs:** real detection for the 3 Google-AIO draft checks (TJ-632) ([#65](https://github.com/timothyjordan/a14y/issues/65)) ([86c32d3](https://github.com/timothyjordan/a14y/commit/86c32d3a6db333d53b194a5cfb42167cac846756))
* **core,docs:** spec for 3 Google-AIO checks in 0.3.0-draft (TJ-631) ([#64](https://github.com/timothyjordan/a14y/issues/64)) ([aacb6ab](https://github.com/timothyjordan/a14y/commit/aacb6ab54ee8c7f011f5a192a292dc5f1c7a8d6f))
* **core,docs:** spec for discovery.in-page-link check in 0.3.0-draft (TJ-676) ([#67](https://github.com/timothyjordan/a14y/issues/67)) ([b3405d7](https://github.com/timothyjordan/a14y/commit/b3405d7bee547617d74419dad1d37e89aeed69c7))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* **core:** treat empty-string dateModified as invalid, not absent (TJ-452) ([#74](https://github.com/timothyjordan/a14y/issues/74)) ([f6dfe0c](https://github.com/timothyjordan/a14y/commit/f6dfe0c724a6ca7dba2c66f43fff3ce0eb63202a))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.21](https://github.com/timothyjordan/a14y/compare/core-v0.3.20...core-v0.3.21) (2026-06-03)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core,docs:** real detection for discovery.in-page-link (TJ-689) ([#68](https://github.com/timothyjordan/a14y/issues/68)) ([ae9b8de](https://github.com/timothyjordan/a14y/commit/ae9b8de6c53d3523e8ba611ebd9a33eec66effb7))
* **core,docs:** real detection for the 3 Google-AIO draft checks (TJ-632) ([#65](https://github.com/timothyjordan/a14y/issues/65)) ([86c32d3](https://github.com/timothyjordan/a14y/commit/86c32d3a6db333d53b194a5cfb42167cac846756))
* **core,docs:** spec for 3 Google-AIO checks in 0.3.0-draft (TJ-631) ([#64](https://github.com/timothyjordan/a14y/issues/64)) ([aacb6ab](https://github.com/timothyjordan/a14y/commit/aacb6ab54ee8c7f011f5a192a292dc5f1c7a8d6f))
* **core,docs:** spec for discovery.in-page-link check in 0.3.0-draft (TJ-676) ([#67](https://github.com/timothyjordan/a14y/issues/67)) ([b3405d7](https://github.com/timothyjordan/a14y/commit/b3405d7bee547617d74419dad1d37e89aeed69c7))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.20](https://github.com/timothyjordan/a14y/compare/core-v0.3.19...core-v0.3.20) (2026-06-03)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core,docs:** real detection for discovery.in-page-link (TJ-689) ([#68](https://github.com/timothyjordan/a14y/issues/68)) ([ae9b8de](https://github.com/timothyjordan/a14y/commit/ae9b8de6c53d3523e8ba611ebd9a33eec66effb7))
* **core,docs:** real detection for the 3 Google-AIO draft checks (TJ-632) ([#65](https://github.com/timothyjordan/a14y/issues/65)) ([86c32d3](https://github.com/timothyjordan/a14y/commit/86c32d3a6db333d53b194a5cfb42167cac846756))
* **core,docs:** spec for 3 Google-AIO checks in 0.3.0-draft (TJ-631) ([#64](https://github.com/timothyjordan/a14y/issues/64)) ([aacb6ab](https://github.com/timothyjordan/a14y/commit/aacb6ab54ee8c7f011f5a192a292dc5f1c7a8d6f))
* **core,docs:** spec for discovery.in-page-link check in 0.3.0-draft (TJ-676) ([#67](https://github.com/timothyjordan/a14y/issues/67)) ([b3405d7](https://github.com/timothyjordan/a14y/commit/b3405d7bee547617d74419dad1d37e89aeed69c7))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.19](https://github.com/timothyjordan/a14y/compare/core-v0.3.18...core-v0.3.19) (2026-06-03)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core,docs:** real detection for discovery.in-page-link (TJ-689) ([#68](https://github.com/timothyjordan/a14y/issues/68)) ([ae9b8de](https://github.com/timothyjordan/a14y/commit/ae9b8de6c53d3523e8ba611ebd9a33eec66effb7))
* **core,docs:** real detection for the 3 Google-AIO draft checks (TJ-632) ([#65](https://github.com/timothyjordan/a14y/issues/65)) ([86c32d3](https://github.com/timothyjordan/a14y/commit/86c32d3a6db333d53b194a5cfb42167cac846756))
* **core,docs:** spec for 3 Google-AIO checks in 0.3.0-draft (TJ-631) ([#64](https://github.com/timothyjordan/a14y/issues/64)) ([aacb6ab](https://github.com/timothyjordan/a14y/commit/aacb6ab54ee8c7f011f5a192a292dc5f1c7a8d6f))
* **core,docs:** spec for discovery.in-page-link check in 0.3.0-draft (TJ-676) ([#67](https://github.com/timothyjordan/a14y/issues/67)) ([b3405d7](https://github.com/timothyjordan/a14y/commit/b3405d7bee547617d74419dad1d37e89aeed69c7))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.18](https://github.com/timothyjordan/a14y/compare/core-v0.3.17...core-v0.3.18) (2026-06-03)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core,docs:** real detection for the 3 Google-AIO draft checks (TJ-632) ([#65](https://github.com/timothyjordan/a14y/issues/65)) ([86c32d3](https://github.com/timothyjordan/a14y/commit/86c32d3a6db333d53b194a5cfb42167cac846756))
* **core,docs:** spec for 3 Google-AIO checks in 0.3.0-draft (TJ-631) ([#64](https://github.com/timothyjordan/a14y/issues/64)) ([aacb6ab](https://github.com/timothyjordan/a14y/commit/aacb6ab54ee8c7f011f5a192a292dc5f1c7a8d6f))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.17](https://github.com/timothyjordan/a14y/compare/core-v0.3.16...core-v0.3.17) (2026-05-19)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.16](https://github.com/timothyjordan/a14y/compare/core-v0.3.15...core-v0.3.16) (2026-05-19)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core:** add 1.1.0 modified-date checks that validate the date string (TJ-610) ([#58](https://github.com/timothyjordan/a14y/issues/58)) ([37fb634](https://github.com/timothyjordan/a14y/commit/37fb6343c369ba0a190afa428fb474b86a1178e2))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** methodology-bumped diff + /scorecards/scoring/ ([#57](https://github.com/timothyjordan/a14y/issues/57)) ([26e4d41](https://github.com/timothyjordan/a14y/commit/26e4d414f29733900edd96e0f3d5ed40b6f4306c))
* **scorecard:** pin draft to 1.1.0 modified-date checks (TJ-611) ([#59](https://github.com/timothyjordan/a14y/issues/59)) ([4d448ac](https://github.com/timothyjordan/a14y/commit/4d448acf0afab13c398675a729417f4b11e38e84))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.15](https://github.com/timothyjordan/a14y/compare/core-v0.3.14...core-v0.3.15) (2026-05-18)


### Features

* **core,cli:** repeatable --scorecard flag for multi-scorecard scans (TJ-580) ([#55](https://github.com/timothyjordan/a14y/issues/55)) ([eccdbfd](https://github.com/timothyjordan/a14y/commit/eccdbfd953b8fa2bb3960cb672e10e600f8dbaa0))
* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** implement per-check-mean-v1 scoring (TJ-561) ([#54](https://github.com/timothyjordan/a14y/issues/54)) ([c1e3c42](https://github.com/timothyjordan/a14y/commit/c1e3c421745a7778611746c07f47310ce4eb9084))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **core:** spec for per-check-mean-v1 scoring methodology (TJ-560) ([#53](https://github.com/timothyjordan/a14y/issues/53)) ([e3fb669](https://github.com/timothyjordan/a14y/commit/e3fb669657c2a7dbc0f29afd0ba2605fc65c9927))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.14](https://github.com/timothyjordan/a14y/compare/core-v0.3.13...core-v0.3.14) (2026-05-18)


### Features

* **core:** add scoringMethodology to ScorecardManifest (TJ-559) ([#51](https://github.com/timothyjordan/a14y/issues/51)) ([bcce8cf](https://github.com/timothyjordan/a14y/commit/bcce8cf59520605ddfdbfe2ea7545f25f5721ef5))
* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.13](https://github.com/timothyjordan/a14y/compare/core-v0.3.12...core-v0.3.13) (2026-05-16)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* **scorecard:** impl — real handlers for three markdown.* checks (TJ-456) ([#39](https://github.com/timothyjordan/a14y/issues/39)) ([1ef2da7](https://github.com/timothyjordan/a14y/commit/1ef2da75d5f53086588858c8b957d02a85838930))
* **scorecard:** spec — three markdown.* draft checks (TJ-456, TJ-288) ([#34](https://github.com/timothyjordan/a14y/issues/34)) ([14c7576](https://github.com/timothyjordan/a14y/commit/14c7576d6252fe1f8c222b1c91c3947c8d383f57))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** bound site crawler memory so large sites no longer OOM (TJ-480, TJ-481) ([#40](https://github.com/timothyjordan/a14y/issues/40)) ([9ce3951](https://github.com/timothyjordan/a14y/commit/9ce395128e4a0f92d3e7cf00507719c7c70038d5))
* **core:** build dist via prepare script so consumers get usable @a14y/core (TJ-470) ([#36](https://github.com/timothyjordan/a14y/issues/36)) ([db74df8](https://github.com/timothyjordan/a14y/commit/db74df87702871ad59f913e29cc74873b9992ab4))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.12](https://github.com/timothyjordan/a14y/compare/core-v0.3.11...core-v0.3.12) (2026-05-15)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* **docs:** render draft scorecard diff vs latest published (TJ-416) ([#28](https://github.com/timothyjordan/a14y/issues/28)) ([a4fa1af](https://github.com/timothyjordan/a14y/commit/a4fa1af73379c71116541aa1dd1c8a4c3f2b9d89))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.11](https://github.com/timothyjordan/a14y/compare/core-v0.3.10...core-v0.3.11) (2026-05-13)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.10](https://github.com/timothyjordan/a14y/compare/core-v0.3.9...core-v0.3.10) (2026-05-11)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.9](https://github.com/timothyjordan/a14y/compare/core-v0.3.8...core-v0.3.9) (2026-05-09)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.8](https://github.com/timothyjordan/a14y/compare/core-v0.3.7...core-v0.3.8) (2026-05-09)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))
* website badge for sharing a14y scores (TJ-420) ([#16](https://github.com/timothyjordan/a14y/issues/16)) ([77e498a](https://github.com/timothyjordan/a14y/commit/77e498a7ed6970b62bd7578e567375c3f4918332))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.7](https://github.com/timothyjordan/a14y/compare/core-v0.3.6...core-v0.3.7) (2026-05-08)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.6](https://github.com/timothyjordan/a14y/compare/core-v0.3.5...core-v0.3.6) (2026-05-08)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))
* introduce draft scorecard workflow for community contributions (TJ-408) ([#9](https://github.com/timothyjordan/a14y/issues/9)) ([431471e](https://github.com/timothyjordan/a14y/commit/431471eef5d6bee2464a31dcdc9b859de7afc01e))
* shareable score summary across CLI, extension, and skill (TJ-376) ([#8](https://github.com/timothyjordan/a14y/issues/8)) ([7ce0c0b](https://github.com/timothyjordan/a14y/commit/7ce0c0b9ed8b47489f7623f56847d63fe802ea2d))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.5](https://github.com/timothyjordan/a14y/compare/core-v0.3.4...core-v0.3.5) (2026-05-08)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

## [0.3.4](https://github.com/timothyjordan/a14y/compare/core-v0.3.3...core-v0.3.4) (2026-05-08)


### Features

* **core:** seed-loading progress events (TJ-235) ([cbcb419](https://github.com/timothyjordan/a14y/commit/cbcb41964e84259731822054b018f088299b48fe))
* **docs:** a14y.dev landing redesign + manual light/dark toggle ([#19](https://github.com/timothyjordan/a14y/issues/19)) ([a9ff3cc](https://github.com/timothyjordan/a14y/commit/a9ff3cc55acdc0eae26fb57bc2b8a69ded78f1ef))


### Bug Fixes

* **ci:** make release publish job tolerate workspace bumps (TJ-240) ([#33](https://github.com/timothyjordan/a14y/issues/33)) ([fbd1ffe](https://github.com/timothyjordan/a14y/commit/fbd1ffebb811239d40d1e4c71781f88f83d08746))
* **core:** parallelize sitemapindex children with bounded concurrency (TJ-234) ([745a906](https://github.com/timothyjordan/a14y/commit/745a9063618705265d16409a332553a01da5a52d))
* **core:** per-request timeout in httpClient (TJ-233) ([7396c30](https://github.com/timothyjordan/a14y/commit/7396c304d22ae8547ca71b52a5dfb35bc59658f2))
* **core:** point DOCS_BASE_URL at canonical a14y.dev (TJ-395) ([#70](https://github.com/timothyjordan/a14y/issues/70)) ([f744bbf](https://github.com/timothyjordan/a14y/commit/f744bbf60776629ee440f30b438aa1b579c5f851))
* stop crawler discovering phantom URLs from .md mirrors ([#50](https://github.com/timothyjordan/a14y/issues/50)) ([978dedd](https://github.com/timothyjordan/a14y/commit/978dedd535df89103ab28e79125278a6f6322d1c))

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
