#!/usr/bin/env node
// Build the request-only competitive-overview PDF from press/competitive-overview.typ.
// Output: public/press/a14y-competitive-overview-vYYYY-MM.pdf
// Requires: typst on PATH (install with `brew install typst`).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, "..");
const sourcePath = join(docsRoot, "press", "competitive-overview.typ");
const fontDir = join(docsRoot, "press", "fonts");
const outputDir = join(docsRoot, "public", "press");

if (!existsSync(sourcePath)) {
  console.error(`source not found: ${sourcePath}`);
  process.exit(1);
}

const typstCheck = spawnSync("typst", ["--version"], { encoding: "utf8" });
if (typstCheck.status !== 0) {
  console.error("typst not on PATH. install with: brew install typst");
  process.exit(1);
}

const now = new Date();
const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const outputName = `a14y-competitive-overview-v${yearMonth}.pdf`;
const outputPath = join(outputDir, outputName);

mkdirSync(outputDir, { recursive: true });

console.log(`compiling ${sourcePath}`);
execFileSync(
  "typst",
  ["compile", sourcePath, outputPath, "--font-path", fontDir],
  { stdio: "inherit" },
);

const size = statSync(outputPath).size;
console.log(`wrote ${outputPath} (${(size / 1024).toFixed(1)} KB)`);
