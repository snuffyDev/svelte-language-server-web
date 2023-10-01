import { defineConfig } from "vite";

export default defineConfig({
  server: {
    fs: { allow: ["..", "../..", "../../../"], strict: false },
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
