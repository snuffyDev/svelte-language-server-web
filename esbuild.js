/** @typedef {Partial<Record<`node:${import('node-stdlib-browser').PackageNames}` | `${import('node-stdlib-browser').PackageNames}`, 'empty' | undefined | boolean>>} Modules */
import glob from "fast-glob";
import { build, transform } from "esbuild";
import { readFileSync, readdirSync, rmSync } from "fs";
import { readFile } from "fs/promises";
import { builtinModules, createRequire } from "module";
import path from "path";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const moduleShimmerName = "ModuleShimmer";
const __dirname = path.resolve(".");

const moduleShimmer = {
	name: moduleShimmerName,
	setup(build) {
		function escapeRegex(string) {
			return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
		}
		build.onLoad({ filter: /chokidar\/lib\/constants\.js/ }, (args) => {
			const contents = readFileSync(args.path, { encoding: "utf-8" }).replace(
				"os.type()",
				"null",
			);
			return {
				contents,
				loader: "ts",
				resolveDir: path.resolve("/node_modules/chokidar/lib/constants.js"),
			};
		});
		const moduleShims = Object.fromEntries(
			readdirSync(path.resolve(__dirname, "module_shims")).map((filename) => [
				filename.replace(".ts", ""),
				readFileSync(
					path.resolve(__dirname, "module_shims", filename),
				).toString(),
			]),
		);
		build.onLoad({ filter: /prettier\/standalone/ }, async (args) => {
			const contentsBuffer = await readFile(args.path);
			const contents = contentsBuffer
				.toString()
				.replace(/require\(\"/g, 'rekuire("');
			return { contents };
		});
		// w/o this webCustomData.js included twice - as umd and as esm
		build.onResolve(
			{ filter: /.*vscode-html-languageservice.*webCustomData/ },
			(args) => {
				return {
					path: require.resolve(
						"vscode-html-languageservice/lib/esm/languageFacts/data/webCustomData.js",
					),
				};
			},
		);
		for (const mod of Object.keys(moduleShims)) {
			build.onResolve(
				{ filter: new RegExp("^" + escapeRegex(mod) + "$") },
				(args) => ({
					path: mod,
					namespace: moduleShimmerName,
				}),
			);
		}
		build.onLoad(
			{
				filter: /\/svelte-preprocess\/dist\/autoPreprocess\.js/,
			},
			async (args) => {
				const contents = await await readFile(
					path.resolve(
						__dirname,
						"node_modules/svelte-preprocess/dist/autoProcess.js",
					),
				).then((x) => x.toString());
				// .replace("synchronizeHostData()", "if (false)");
				return {
					contents,
					loader: "ts",
					resolveDir: path.resolve(
						__dirname,
						"node_modules/svelte-preprocess/dist/",
					),
				};
			},
		);
		build.onLoad({ filter: /.*/ }, (args) => {
			const contents = moduleShims[args.path];
			return { contents, loader: "ts", resolveDir: "node_modules" };
		});
	},
};
function createAliasPlugin(aliasConfig) {
	return {
		name: "alias-plugin",
		setup(build) {
			// Convert the input array into an array of regex and replacement pairs
			const aliasPairs = aliasConfig.map(({ find, replacement }) => ({
				find: new RegExp(find),
				replacement,
			}));
			// Handle the transform step
			build.onLoad({ filter: /.*/ }, async (args) => {
				// Read the original file content
				const source = await readFile(args.path, "utf8");
				// Apply each alias in order
				let transformedSource = source;
				for (const { find, replacement } of aliasPairs) {
					transformedSource = transformedSource.replace(find, replacement);
				}
				// Return the transformed file content
				return {
					contents: await transform(transformedSource, {
						platform: "browser",
						format: "esm",
						keepNames: true,

						minify: false,
						treeShaking: false,

						minifySyntax: false,
						minifyIdentifiers: false,
						minifyWhitespace: false,
						loader: "ts",
					}).then((value) => value.code),
				};
			});
		},
	};
}
const aliases = [
	{
		find: /vscode.html.languageservice.lib.umd.*webCustomData/,
		replacement:
			"vscode-html-languageservice/lib/esm/languageFacts/data/webCustomData.js",
	},
	{
		find: /events/,
		replacement: "events/",
	},
	{
		find: /^fs$/,
		replacement: path.resolve("./module_shims/fs.ts"),
	},
	{
		find: /^path$/,
		replacement: path.resolve("./deps/path-deno.ts"),
	},
	{
		find: /^perf_hooks$/,
		replacement: path.resolve("./module_shims/perf_hooks.ts"),
	},
	{
		find: /^util$/,
		replacement: path.resolve("./module_shims/util.ts"),
	},
	{
		find: /^os$/,
		replacement: path.resolve("./module_shims/os.ts"),
	},
	{
		find: /^process$/,
		replacement: path.resolve("./module_shims/process.ts"),
	},
	{
		find: /^stylus$/,
		replacement: path.resolve("./module_shims/stylus.ts"),
	},
];
try {
	rmSync("./dist", { recursive: true });
} catch (_a) {}
await build({
	plugins: [
		nodeModulesPolyfillPlugin({
			globals: { Buffer: true,  process: true },
			/**@type {Modules} */
			modules: {util:true,buffer:true,fs:true, net:true, os: true,'node:process': true, 'process':true},
		}),
		moduleShimmer,
		createAliasPlugin(aliases),
	],
	sourcemap: false,
	platform: "browser",
	external: ["@codemirror/state"],
	outdir: "./dist",
	loader: { ".ts": "ts", ".js": "js" },
	define: {
		global: "globalThis",
		__dirname: '""',
		_self: "globalThis",
		__filename: '""',
		require: "require",
		define: "null",
		importScripts: "_importScripts",
		importSvelte: "_importSvelte",
		importSveltePreprocess: "_importSveltePreprocess",
		importPrettier: "_importPrettier",
		sorcery_1: "_sorceryShim",
		__importStar: "__importStar",
		__importDefault: "__importDefault",
	},
	format: "esm",
	bundle: true,
	tsconfig: "./tsconfig.build.json",
	minifySyntax: false,
	minifyIdentifiers: true,
	minifyWhitespace: true,
	treeShaking: true,
	entryPoints: [
		...glob.sync("./src/deps/**/*.ts", { absolute: true }),
		"./src/index.ts",
	],
}).then(() => {
	process.nextTick(() => {
		try {
			execSync("npx tsc", {
				stdio: "inherit",
				shell: "zsh",
				encoding: "utf-8",
			});
		} catch {}
	});
});
