import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

/** Minimal shape we read from the source `package.json`. */
export interface SourcePackageJson {
  name?: string;
  version?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface GenerateDistPackageJsonOptions {
  /**
   * Path to the source `package.json`.
   * Defaults to `<viteRoot>/package.json`.
   */
  source?: string;
  /**
   * Name of the file written into the bundle directory.
   * Defaults to `"package.json"`.
   */
  filename?: string;
  /**
   * Build the object that gets serialized to the dist `package.json`.
   *
   * Default: copy `name`, `version`, `engines`, `dependencies` from the source
   * and add `private: true` plus `main: "index.js"` — the shape Firebase
   * Functions needs to `npm install` runtime deps at deploy time.
   */
  transform?: (src: SourcePackageJson) => Record<string, unknown>;
}

const defaultTransform = (src: SourcePackageJson): Record<string, unknown> => ({
  name: src.name,
  version: src.version,
  private: true,
  main: "index.js",
  engines: src.engines,
  dependencies: src.dependencies,
});

/**
 * Emits a slim `package.json` alongside the built bundle so that downstream
 * consumers (e.g. Firebase Functions) can `npm install` runtime deps in the
 * deployed folder.
 */
export function generateDistPackageJson(
  options: GenerateDistPackageJsonOptions = {},
): Plugin {
  const filename = options.filename ?? "package.json";
  const transform = options.transform ?? defaultTransform;
  let config: ResolvedConfig;

  return {
    name: "blotch:generate-dist-package-json",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    async writeBundle(outputOptions) {
      const source = options.source ?? resolve(config.root, "package.json");
      // outputOptions.dir is set for lib/multi-file builds; fall back to Vite's build.outDir.
      const outDir =
        outputOptions.dir ?? resolve(config.root, config.build.outDir);
      const dest = resolve(outDir, filename);

      const raw = await readFile(source, "utf8");
      const src = JSON.parse(raw) as SourcePackageJson;
      const distPkg = transform(src);

      await writeFile(dest, JSON.stringify(distPkg, null, 2) + "\n");
      this.info(`wrote ${dest}`);
    },
  };
}
