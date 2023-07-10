// fs.ts - shims for SLS
// preshim.ts
import "./preshim";
import sys from "./sys";
//@ts-ignore
import process from "process";
/** vite-ignore */
//@ts-ignore
import ts from "typescript";

import * as Buffer from "buffer";
import * as ppts from "svelte-preprocess/dist/processors/typescript.js";

import { version as prettierVersion } from "prettier/package.json";
import * as d from "svelte-language-server/dist/src/lib/documents/configLoader.js";
import * as preprocess from "svelte-preprocess";
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
	globalThis.typescript$1 = {
		...rest,
		sys,
	};
	//@ts-ignore
	ts.sys = globalThis.typescript$1.sys;
}

//@ts-ignore it's fine
process.versions = {};
process.versions.node = "v16.16.1";

const _self = self as any;
_self.__dirname = import.meta.url || "/tsconfig";

_self._Function = function (...args) {
	// console.log(...args);
	if (args.join("") === "return this") {
		// console.log("return this");
		return function () {
			// console.log("return this 2");
			//@ts-ignore
			return this;
		};
	}

	if (args.join("") === "modulePathreturn import(modulePath)") return (x) => x;
	return new GLOBAL_FUNCTION(...arguments);
};
globalThis._Function = _self._Function;

_self._importScripts = function (...args) {
	console.error("Trying to import a script", args);
};

_self._Buffer = Buffer.Buffer;

const compilerOptions = {
	...ts.getDefaultCompilerOptions(),
	strict: true,
	esModuleInterop: true,
	lib: ["DOM", "DOM.iterable", "ESNext", "ES2020"],
	module: ts.ModuleKind.ESNext,
	suppressOutputPathCheck: true,
	skipLibCheck: true,
	skipDefaultLibCheck: true,
	moduleResolution: undefined,
	useCaseSensitiveFileNames: true,
	allowJs: true,
} as const;

const conf: d.SvelteConfig = {
	preprocess: [
		ppts.default({
			tsconfigFile: "/tsconfig.json",
			compilerOptions,
			tsconfigDirectory: "/",
		}),
	],

	isFallbackConfig: false,
};
const { configLoader } = d;
configLoader.getConfig = (x) => conf;
configLoader.awaitConfig = async () =>
	Promise.resolve(await VFS.readFile("svelte.config.js"));
configLoader.loadConfigs = () => Promise.resolve("file:///");

const required = {
	"prettier/package.json": { version: prettierVersion },
	"svelte/package.json": { version: svelteVersion },
	"svelte-preprocess/package.json": { version: preprocess_version },
	"svelte-preprocess": preprocess,
	"svelte/compiler": { VERSION, ...svelte },
	"svelte/compiler.cjs": { VERSION, ...svelte },
	"svelte/compiler.js": svelte,
	"/prettier": prettier,
	"/prettier/": prettier,
};

_self.require = function (req) {
	if (throwIfRequire.hasOwnProperty(req)) throw Error("");
	// console.log(req);
	for (const imp of Object.keys(required)) {
		// console.log(req);
		if (req.endsWith(imp)) return required[imp];
	}

	console.error("dynamic required missing", req);
};

_self.require.resolve = (x) => x;

_self.importSvelte = required["svelte/compiler"];
_self.importSveltePreprocess = required["svelte-preprocess"];
_self.importPrettier = required["prettier"];

const throwIfRequire = {
	"./node_modules/@microsoft/typescript-etw": true,
	"svelte-native/package.json": true,
};

let dir = "/";
