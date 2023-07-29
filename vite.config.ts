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
			output: { compact: false, sourcemap: false },
			watch: false,
		},
		sourcemap: false,
		minify: false,
		lib: { entry: "dist/index.js", formats: ["es"] },
		outDir: "../../Documents/GitHub/SvelteLab/src/lib/language_servers/svelte",
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
		exclude: ["typescript"],
		force: true,
	},
	preview: {},
});
