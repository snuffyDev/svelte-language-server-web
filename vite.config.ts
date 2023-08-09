import { defineConfig } from "vite";

export default defineConfig({
	build: {
		rollupOptions: {
			treeshake: false,
			output: { compact: false, sourcemap: false },
			watch: false,
		},
		sourcemap: false,
		minify: false,
		outDir: "build",
		// lib: { entry: "dist/index.js", formats: ["es"] },
	},
	worker: {
		rollupOptions: {
			treeshake: false,
			output: { compact: false, sourcemap: false },
			watch: false,
		},
	},
	esbuild: {
		minifySyntax: false,
		minifyIdentifiers: false,
		minifyWhitespace: false,
		define: {
			"process.env.NODE_ENV": '"production"',
		},
	},

	optimizeDeps: {
		esbuildOptions: {
			minify: false,
			minifySyntax: false,
			minifyIdentifiers: false,
		},
		exclude: ["./dist/index.js", "./dist/worker.js"],
		force: true,
	},
	preview: {},
});
