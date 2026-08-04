#!/usr/bin/env node
/**
 * Emits a slim dist/package.json alongside the Vite-built bundle so that
 * Firebase Functions can `npm install` runtime deps in the deployed folder.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const srcPkgPath = resolve(pkgRoot, "package.json");
const distPkgPath = resolve(pkgRoot, "dist", "package.json");

const srcPkg = JSON.parse(await readFile(srcPkgPath, "utf8"));

const distPkg = {
  name: srcPkg.name,
  version: srcPkg.version,
  private: true,
  main: "index.js",
  engines: srcPkg.engines,
  dependencies: srcPkg.dependencies,
};

await writeFile(distPkgPath, JSON.stringify(distPkg, null, 2) + "\n");
console.log(`Wrote ${distPkgPath}`);
