/** @typedef {Partial<Record<`node:${import('node-stdlib-browser').PackageNames}` | `${import('node-stdlib-browser').PackageNames}`, 'empty' | undefined | boolean>>} Modules */
import { build, transform } from "esbuild";
import { readFileSync, readdirSync, rmSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { execSync } from "child_process";
import resolve from "esbuild-plugin-resolve";
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
			() => {
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
				() => ({
					path: mod,
					namespace: moduleShimmerName,
				}),
			);
		}
		build.onLoad(
			{
				filter: /\/svelte-preprocess\/dist\/autoPreprocess\.js/,
			},
			async () => {
				const contents = await readFile(
					path.resolve(
						__dirname,
						"node_modules/svelte-preprocess/dist/autoProcess.js"
					)
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

						minify: true,
						treeShaking: true,

						minifySyntax: true,
						minifyIdentifiers: true,
						minifyWhitespace: true,
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
		find: /graceful-fs/,
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
			globals: { Buffer: true, process: true },
			/**@type {Modules} */
			modules: {
				util: true,
				buffer: true,
				fs: true,
				net: true,
				os: true,
				"node:process": true,
				process: true,
			},
		}),
		moduleShimmer,
		createAliasPlugin(aliases),
		{
			name: "umd2esm",
			setup(build) {
				build.onResolve(
					{ filter: /(vscode-.*|estree-walker|jsonc-parser)/ },
					(args) => {
						const pathUmdMay = require.resolve(args.path, {
							paths: [args.resolveDir],
						});
						const pathEsm = pathUmdMay.replace("/umd/", "/esm/");
						return { path: pathEsm };
					},
				);
			},
		},
		resolve({
			fs: path.resolve("./module_shims/"),
			"graceful-fs": path.resolve("./module_shims"),
		}),
		// dtsPlugin(),
	],
	sourcemap: true,
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
		setImmediate: "queueMicrotask",
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
	minifySyntax: true,
	minifyIdentifiers: true,
	metafile: true,
	splitting: true,
	minifyWhitespace: true,
	minify: true,

	treeShaking: true,
	entryPoints: [
		// ...glob.sync("./module_shims/*.ts", { absolute: true }),
		"./src/index.ts",
		"./src/protocol.ts",
	],
})
	.then((output) => {
		return writeFile("./metafile.json", JSON.stringify(output.metafile));
	})
	.then(() => {
		try {
			process.nextTick(() => {
				try {
					execSync("npx tsc -p ./tsconfig.build.json", {
						stdio: "inherit",
						shell: "zsh",
						encoding: "utf-8",
					});
				} catch {}
			});
		} catch {}
	});
