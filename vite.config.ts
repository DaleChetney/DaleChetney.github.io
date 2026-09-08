/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fg from "fast-glob";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "src");

// Every src/**/index.html is a build entry. Root index.html -> "index".
const input = Object.fromEntries(
  fg.sync("**/index.html", { cwd: root }).map((file) => {
    const name = file.replace(/\/?index\.html$/, "") || "index";
    return [name, resolve(root, file)];
  }),
);

export default defineConfig({
  root,
  base: "/",
  publicDir: resolve(root, "../public"),
  // Vite 8's built-in tsconfig path resolution, used instead of the
  // `vite-tsconfig-paths` plugin, which Vite 8 deprecates.
  resolve: { tsconfigPaths: true },
  build: {
    outDir: resolve(root, "../dist"),
    emptyOutDir: true,
    rollupOptions: { input },
  },
  test: {
    // Vitest's root otherwise defaults to Vite's `root` (`src`), which would
    // make `include: ["src/**/*.test.ts"]` match `src/src/**` and find zero
    // test files.
    root: resolve(root, ".."),
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
