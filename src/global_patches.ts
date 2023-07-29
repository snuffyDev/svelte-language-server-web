// fs.ts - shims for SLS
import "./prelude";

//@ts-ignore
import process from "process";

//@ts-ignore
import _ts = require("typescript");
const ts = _ts.default;
import * as Buffer from "buffer/";

import {
	SvelteConfig,
	setConfigLoader,
} from "./deps/svelte-language-server/src/lib/documents/configLoader.js";
import fs = require("fs");

//@ts-ignore
import ppts = require("svelte-preprocess/dist/processors/typescript.js");
import * as transformerTS from "svelte-preprocess/dist/transformers/typescript.js";
import preprocess from "svelte-preprocess/dist/autoProcess";

import { version as prettierVersion } from "prettier/package.json";
import { version as preprocess_version } from "svelte-preprocess/package.json";
import * as svelte from "svelte/compiler";
import { version as svelteVersion } from "svelte/package.json";
import { prettier } from "./prettier";

const GLOBAL_FUNCTION = Function;
if (!globalThis.typescript$1) {
	const { sys: _sys, ...rest } = ts;
	// setSys(sys);
	globalThis.typescript$1 = ts;
	//@ts-ignore
}

//@ts-ignore it's fine
process.versions = {};
process.versions.node = "v16.16.1";

globalThis.__dirname = import.meta.url || "/tsconfig";

// patching LN#47 in src/deps/svelte-language-server/src/lib/documents/configLoader.ts
globalThis._Function = function (...args) {
	if (args.join("") === "return this") {
		return function () {
			return this;
		};
	}

	if (args.join("") === "modulePathreturn import(modulePath)")
		return (x) => {
			return x;
		};

	return new GLOBAL_FUNCTION(...arguments);
};

globalThis.__importStar = (req) => {
	return req;
};

globalThis._importScripts = function (...args: any[]) {
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
		ppts.default({
			compilerOptions,
			tsconfigDirectory: "/",
			tsconfigFile: "/tsconfig.json",
		}),
	], // ppts.default({
	// 	tsconfigFile: "/tsconfig.json",
	// 	tsconfigDirectory: "/",
	// 	compilerOptions,
	// }),
	// ],
};

setConfigLoader("getConfig", (_x) => conf);

const required = {
	"prettier/package.json": { version: prettierVersion },
	"svelte/package.json": { version: svelteVersion },
	"svelte-preprocess/package.json": { version: preprocess_version },
	"svelte-preprocess/autoProcess.js": preprocess,
	"svelte-preprocess": preprocess,
	fs,
	"graceful-fs": fs,
	typescript: ts,
	"../transformers/typescript.js": { transformer: transformerTS.transformer },
	"./transformers/typescript": { transformer: transformerTS.transformer },
	"svelte/compiler": { ...svelte },
	"svelte/compiler.cjs": { ...svelte },
	"svelte/compiler.js": svelte,
	"/prettier": prettier,
	"/prettier/": prettier,
};

// @ts-expect-error patching require
globalThis.require = function (req) {
	if (throwIfRequire.hasOwnProperty(req))
		throw Error("Cannot requore module " + req + ".");
	for (const imp of Object.keys(required)) {
		if (typeof req === "string" && req?.endsWith(imp)) return required[imp];
	}
	console.error("dynamic required missing", req);
};

globalThis.__importDefault = function (req) {
	return { default: req };
};

// @ts-expect-error patching require.resolve
globalThis.require.resolve = (x) => x;

globalThis.importSvelte = required["svelte/compiler"];
globalThis.importSveltePreprocess = required["svelte-preprocess"];
globalThis.importPrettier = required["prettier"];
const throwIfRequire = {
	"./node_modules/@microsoft/typescript-etw": true,
	"svelte-native/package.json": true,
};
