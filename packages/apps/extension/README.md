# @a14y/extension

The a14y Chrome extension — scores any page or whole site for how
readable it is by AI agents, using the open
[a14y scorecard](https://a14y.dev/spec/). Same engine as the
[`a14y` CLI](https://www.npmjs.com/package/a14y); same URL + same
scorecard version = same score.

## Develop

```
npm install                       # once, from repo root
npm run dev -w @a14y/extension    # watch-mode vite build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. **Load unpacked** → pick `packages/apps/extension/dist/`

Vite rebuilds on save; reload the extension in `chrome://extensions`
to pick up the new bundle. The popup and the options / results pages
all hot-reload automatically.

## Build

```
npm run build -w @a14y/extension
```

`prebuild` auto-regenerates `src/icons/{16,32,48,128}.png` from the
canonical brand SVGs in `packages/apps/docs/public/brand/`. Never edit
the PNGs directly — edit the SVG source and rerun the build.

## Package the .zip locally

```
npm run package -w @a14y/extension
```

Produces `a14y-extension-<version>.zip` at the extension package root.
Reuses the existing `dist/` by default — pass `--rebuild` (forwarded
via `-- --rebuild`) to force a fresh vite build first. The zip is
gitignored. CI runs the same script when cutting a release; this
target exists so you can preview the exact artifact locally before
shipping it.

## Capture store screenshots

The 1280×800 screenshots in `store/screenshots/` are committed. To
regenerate (e.g. after a UI change), temp-install puppeteer-core and
run the capture script:

```
cd packages/apps/extension
npm install --no-save puppeteer-core
npm run build                # make sure dist/ is current
node scripts/capture-screenshots.mjs
npm uninstall puppeteer-core
```

The script spins up a tiny localhost server on `dist/` (so Vite's
absolute asset paths resolve) and drives system Chrome headless to
render the real popup at each of the idle / running / done states.

## Cut a release

The extension is versioned and shipped by
[release-please](https://github.com/googleapis/release-please) the
same way the npm packages are. Use Conventional Commits scoped to
`extension` (e.g. `feat(extension): …`, `fix(extension): …`) so the
release-please bot opens a release PR with the right semver bump.
Merging that PR creates an `extension-v<version>` git tag and the
`publish-extension` job in `.github/workflows/release.yml` builds the
extension, runs `npm run package`, and attaches the
`a14y-extension-<version>.zip` to the resulting GitHub Release.

The /chrome-extension/ page on a14y.dev reads from that GitHub
Release at docs build time, so the public download link updates
automatically — no manual edits required.

## Submit to Chrome Web Store

Everything a human needs to fill the upload form lives in `store/`:

| Artifact                     | File                              |
|-----------------------------|-----------------------------------|
| Store listing (all copy)    | `store/listing.md`                |
| Permission justifications   | `store/permissions.md`            |
| Single-purpose statement    | `store/single-purpose.md`         |
| 1280×800 screenshots (×3)   | `store/screenshots/*.png`         |
| Privacy policy URL          | `https://a14y.dev/privacy/`       |
| 128×128 store icon          | `src/icons/128.png`               |
| Extension zip               | from the GitHub Release           |

Steps:

1. Download `a14y-extension-<version>.zip` from the
   [latest extension release](https://github.com/timothyjordan/a14y/releases?q=extension-v).
   (Locally, `npm run package -w @a14y/extension` builds the same
   artifact if you want to dry-run an upload.)
2. Go to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
3. New item (first submit) or New package (subsequent). Upload the zip.
4. Paste listing fields from `store/listing.md`, screenshots from
   `store/screenshots/`, 128×128 from `src/icons/128.png`.
5. Paste permission justifications from `store/permissions.md` and
   the single-purpose statement from `store/single-purpose.md`.
6. Submit for review.

Review takes anywhere from a few hours to a few days. On approval,
swap the manual-install copy on a14y.dev's `/chrome-extension/` page
for the real CWS listing link.

## Project layout

```
packages/apps/extension/
├── manifest.json            MV3 manifest
├── src/
│   ├── popup.html|css|ts    320×auto popup — brand row, actions, score card
│   ├── background.ts        SW — starts audits, owns offscreen lifecycle
│   ├── offscreen.html|ts    long-lived audit host (outlives SW)
│   ├── results.html|ts      full-report viewer at chrome-extension://…/results.html
│   ├── options.html|ts      stub for future settings
│   ├── bridge.ts            type contracts for popup ↔ SW ↔ offscreen messages
│   ├── icons/               generated PNGs + copied logo SVG
│   └── lib/markdown.ts      SiteRun → Markdown export
├── scripts/
│   ├── build-icons.mjs          SVG → PNG icon pipeline
│   ├── package-extension.mjs    dist/ → zip
│   └── capture-screenshots.mjs  real popup → 1280×800 PNG via puppeteer-core
├── store/                   CWS listing artifacts
└── test/markdown.test.ts    vitest — SiteRun → Markdown
```

The audit engine itself lives in `@a14y/core`; this package is a thin
MV3 host for it.
