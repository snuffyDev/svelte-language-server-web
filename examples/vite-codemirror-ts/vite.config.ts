import { defineConfig } from "vite";

export default defineConfig({
  server: {
    fs: { allow: ["..", "../..", "../../../"], strict: false },
  },

  build: {
    rollupOptions: {
      treeshake: true,
      output: { compact: false, sourcemap: false },
      watch: false,
    },
    sourcemap: false,
    minify: true,

    outDir: "build",
    // lib: { entry: "dist/index.js", formats: ["es"] },
  },
  worker: {
    format: "es",
    rollupOptions: {
      treeshake: true,
      output: { compact: true, sourcemap: false },
      watch: false,
    },
  },
  esbuild: {
    minifySyntax: true,
    minifyIdentifiers: true,
    minifyWhitespace: true,
  },

  optimizeDeps: {
    exclude: [
      "./../../dist/index.js",
      "./../../dist/worker.js",
      "./../../dist/tsWorker.js",
    ],
    force: true,
  },
});
