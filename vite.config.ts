import { defineConfig } from "vite";

export default defineConfig({
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
		define: {
			"process.env.NODE_ENV": '"production"',
		},
	},

	optimizeDeps: {
		exclude: ["./dist/index.js", "./dist/worker.js"],
		force: true,
	},
	preview: {},
});
