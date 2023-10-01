import { readFileSync, readdirSync, rmSync } from "fs";
import { readFile } from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import resolve from "esbuild-plugin-resolve";
import { defineConfig } from "tsup";
import { transform } from "esbuild";

const require = createRequire(import.meta.url);
const moduleShimmerName = "ModuleShimmer";
const __dirname = path.resolve(".");

const env = process.env.NODE_ENV || "production";
const SVELTELAB_DIR = path.resolve(
	"../SvelteLab/src/lib/lsp/svelte",
);
const DIST_DIR = path.resolve("./dist");
const OUT_DIR =
	env === "production"
		? DIST_DIR
		: env === "testing"
			? DIST_DIR
			: SVELTELAB_DIR;

/** @type {import('esbuild').Plugin} */
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
				filename.includes("@babel")
					? "@babel/core"
					: filename.replace(".ts", ""),
				readFileSync(
					path.resolve(
						__dirname,
						"module_shims",
						filename.includes("@babel") ? filename + "/core.ts" : filename,
					),
				).toString(),
			]),
		);

		build.onLoad(
			{ filter: /\/typescript\/lib\/tsserverlibrary\.js/ },
			async (args) => {
				const contents = await (
					await readFile(
						path.resolve(
							__dirname,
							"node_modules/typescript/lib/tsserverlibrary.js",
						),
					).then((x) => x.toString())
				).replace(" debugger;", "");
				return {
					contents,
					loader: "ts",
					resolveDir: path.resolve(__dirname, "node_modules/typescript/lib/"),
				};
			},
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
		build.onLoad({ filter: /postcss\/lib\/postcss.mjs/ }, async () => {
			return {
				contents: await readFile(
					"node_modules/postcss/lib/postcss.js",
				).toString(),
				loader: "ts",
				resolveDir: path.resolve(__dirname, "node_modules/postcss/lib/"),
			};
		});
		build.onLoad(
			{
				filter: /\/svelte-preprocess\/dist\/autoPreprocess\.js/,
			},
			async () => {
				const contents = await readFile(
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
		build.onLoad({ filter: /.*/, namespace: moduleShimmerName }, (args) => {
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
			build.onLoad({ filter: /.*/, namespace: moduleShimmerName }, async (args) => {
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

						treeShaking: true,

						minify: true,

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
		find: /^@babel\/core$/,
		replacement: path.resolve("./module_shims/@babel/core.ts"),
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
		find: /^stylus$/,
		replacement: path.resolve("./module_shims/stylus.ts"),
	},
];

try {
	rmSync(OUT_DIR, {
		recursive: true,
	});
} catch (_a) { }

export default defineConfig({
	esbuildPlugins: [
		nodeModulesPolyfillPlugin({
			modules: {
				buffer: true,
				stream: true,
				tty: true,
				net: true,
				punycode: true,
				http: true,
				https: true,
				tls: true,
				zlib: true,
				inspector: true,
				process: true,
				"node:process": true,
			},
			globals: { process: true, Buffer: true },
		}),
		moduleShimmer,
		createAliasPlugin(aliases),

		{
			name: "umd2esm",
			setup(build) {
				build.onResolve(
					{ filter: /(vscode-.*|jsonc-parser)/ },
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
	],
	esbuildOptions(options, context) {

		options.define = {
			global: "globalThis",
			__dirname: '""',
			_self: "globalThis",
			require: "require",
			setImmediate: "queueMicrotask",
			define: "null",
			importScripts: "_importScripts",
			importPrettier: "_importPrettier",
			__importStar: "__importStar",

			__importDefault: "__importDefault",
		};
	},
	banner: {
		js: `const __filename = new URL(import.meta.url).pathname; `,
	},
	platform: "browser",
	outDir: OUT_DIR,
	noExternal: [/^(?!@codemirror\/state)([-\/a-z0-9\@\.\/]*.+)$/],
	external: ["@codemirror/state"],
	format: "esm",
	define: {
		global: "globalThis",
		__dirname: '""',
		_self: "globalThis",
		require: "require",
		setImmediate: "queueMicrotask",
		define: "null",
		importScripts: "_importScripts",
		importPrettier: "_importPrettier",
		__importStar: "__importStar",

		__importDefault: "__importDefault",
	},

	bundle: true,
	tsconfig: "./tsconfig.build.json",
	minifySyntax: true,
	minifyIdentifiers: true,
	metafile: true,
	splitting: true,
	minifyWhitespace: true,
	minify: true,
	treeshake: true,
	dts: true,
	env: {
		NODE_ENV: "production",
	},
	replaceNodeEnv: false,
	entryPoints: [
		// ...glob.sync("./module_shims/*.ts", { absolute: true }),
		"./src/index.ts",
		"./src/worker.ts",
		"./src/tsWorker.ts",
	],
});
