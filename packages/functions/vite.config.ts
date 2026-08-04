import { defineConfig } from "vite";
import { builtinModules } from "node:module";

// Firebase Functions runtime deps must NOT be bundled — they resolve at deploy time
// from the generated dist/package.json.
const runtimeExternals = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  /^firebase-functions(\/.*)?$/,
  /^firebase-admin(\/.*)?$/,
];

export default defineConfig({
  build: {
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["cjs"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: runtimeExternals,
      output: {
        exports: "named",
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/index.ts"],
    },
  },
});
