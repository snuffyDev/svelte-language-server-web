// fs.ts - shims for SLS
// preshim.ts
import "./preshim";
//@ts-ignore
import process from "process";
/** vite-ignore */
//@ts-ignore
import ts, { setSys } from "typescript";

import * as Buffer from "buffer";
import ppts from "svelte-preprocess/dist/processors/typescript.js";
import * as transformerTS from "svelte-preprocess/dist/transformers/typescript.js";
// import * as transformerTS from "svelte-preprocess/dist/transformers/typescript.js";
import * as globalStyle from "svelte-preprocess/dist/processors/globalStyle";
import { version as prettierVersion } from "prettier/package.json";
import {
	SvelteConfig,
	setConfigLoader,
} from "./deps/svelte-language-server/src/lib/documents/configLoader.js";
// console.log(d);
import * as preprocess from "svelte-preprocess/dist/autoProcess";
import { version as preprocess_version } from "svelte-preprocess/package.json";
import * as svelte from "svelte/compiler";
import { VERSION } from "svelte/compiler";
import { version as svelteVersion } from "svelte/package.json";
import { prettier } from "./prettier";
import { VFS } from "./vfs";

const GLOBAL_FUNCTION = Function;
const typescript$1 = ts;
if (!globalThis.typescript$1) {
	const { sys: _sys, ...rest } = typescript$1;
	// setSys(sys);
	globalThis.typescript$1 = typescript$1;
	//@ts-ignore
	// ts.sys = globalThis.typescript$1.sys;
	console.log(ts.sys);
}

//@ts-ignore it's fine
process.versions = {};
process.versions.node = "v16.16.1";

globalThis.__dirname = import.meta.url || "/tsconfig";

globalThis._Function = function (...args) {
	// console.log(...args);
	if (args.join("") === "return this") {
		// console.log("return this");
		return function () {
			// console.log("return this 2");
			//@ts-ignore
			return this;
		};
	}

	if (args.join("") === "modulePathreturn import(modulePath)")
		return (x) => {
			console.log(x);
			return x;
		};
	return new GLOBAL_FUNCTION(...arguments);
};
globalThis.__importStar = (req) => {
	console.warn("IMPORT STAR", req);
	return req;
};
globalThis._Function = globalThis._Function;

globalThis._importScripts = function (...args) {
	console.error("Trying to import a script", args);
};

globalThis._Buffer = Buffer.Buffer;

const compilerOptions = {
	...ts.getDefaultCompilerOptions(),
	strict: true,
	esModuleInterop: true,
	lib: ["DOM", "DOM.iterable", "ESNext", "ES2020"],
	module: "esnext",
	target: "esnext",
	suppressOutputPathCheck: true,
	skipLibCheck: true,
	skipDefaultLibCheck: true,
	moduleResolution: "node",
	useCaseSensitiveFileNames: true,
	allowJs: true,
} as const;
const conf: SvelteConfig = {
	preprocess: [
		ppts({
			tsconfigFile: "/tsconfig.json",
			compilerOptions,
			tsconfigDirectory: "/",
		}),
	],
	// compilerOptions: { css: "external" },
};

// const { configLoader } = d;

setConfigLoader("getConfig", (x) => conf);
// setConfigLoader("awaitConfig", async (x) => conf);
// configLoader.
// setConfigLoader("loadConfigs", async (x) => void 0);

const required = {
	"prettier/package.json": { version: prettierVersion },
	"svelte/package.json": { version: svelteVersion },
	"svelte-preprocess/package.json": { version: preprocess_version },
	"svelte-preprocess/autoProcess.js": preprocess.sveltePreprocess,
	"svelte-preprocess": preprocess.sveltePreprocess,
	typescript: ts,
	"../transformers/typescript.js": { transformer: transformerTS.transformer },
	"./transformers/typescript": { transformer: transformerTS.transformer },
	"svelte/compiler": { VERSION, ...svelte },
	"svelte/compiler.cjs": { VERSION, ...svelte },
	"svelte/compiler.js": svelte,
	"/prettier": prettier,
	"/prettier/": prettier,
};

globalThis.require = function (req) {
	if (throwIfRequire.hasOwnProperty(req)) throw Error("");
	console.log(req);
	for (const imp of Object.keys(required)) {
		console.log(required[imp]);
		if (req.endsWith(imp)) return required[imp];
	}

	console.error("dynamic required missing", req);
};

globalThis.__importDefault = function (req) {
	return { default: globalThis.require(req) };
};
globalThis.require.resolve = (x) => x;

globalThis.importSvelte = required["svelte/compiler"];
globalThis.importSveltePreprocess = required["svelte-preprocess"];
globalThis.importPrettier = required["prettier"];

const throwIfRequire = {
	"./node_modules/@microsoft/typescript-etw": true,
	"svelte-native/package.json": true,
};

//@ts-ignore
// ts.sys = sys;
let dir = "/";
