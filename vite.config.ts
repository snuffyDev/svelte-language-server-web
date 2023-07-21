import { defineConfig, Plugin as VitePlugin } from "vite";
import { Plugin, PluginBuild } from "esbuild";
import dts from "vite-plugin-dts";
import { readdirSync, readFileSync } from "fs";
import glob from "fast-glob";
import * as path from "path";
import { readFile } from "fs/promises";
import { createRequire } from "module";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const require = createRequire(import.meta.url);
const moduleShimmerName = "ModuleShimmer";

interface SourcemapExclude {
	excludeNodeModules?: boolean;
}

export default defineConfig({
	build: {
		rollupOptions: {
			treeshake: false,
			output: { sourcemap: false },
			watch: false,
		},
		sourcemap: false,
		minify: false,
		outDir: "build",
	},
	esbuild: {
		minifySyntax: false,
		minifyIdentifiers: false,
	},

	optimizeDeps: {
		exclude: ["./dist/index.js"],
		esbuildOptions: {
			minify: false,
			minifySyntax: false,
			minifyIdentifiers: false,
		},
		force: true,
	},
	preview: {},
});
