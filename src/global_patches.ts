// fs.ts - shims for SLS
import "./prelude";

//@ts-ignore
import _ts, { CompilerOptions } from "typescript";
//@ts-ignore
const ts = _ts.default;

import preprocess from "svelte-preprocess/dist/autoProcess.js";
import preprocessJSON from "svelte-preprocess/package.json";
import * as transformerTS from "svelte-preprocess/dist/transformers/typescript.js";
import * as ppts from "svelte-preprocess/dist/processors/typescript.js";
import * as transformerPOSTCSS from "svelte-preprocess/dist/transformers/postcss.js";
import * as transformerBabel from "svelte-preprocess/dist/transformers/babel.js";
import * as transformerSCSS from "svelte-preprocess/dist/transformers/scss.js";
import * as transformerLess from "svelte-preprocess/dist/transformers/less.js";
import * as transformerGlobalStyle from "svelte-preprocess/dist/transformers/globalStyle.js";
import postcss from "postcss";
import fs from "fs";

import path from "path";
import { version as prettierVersion } from "prettier/package.json";
import { version as preprocess_version } from "svelte-preprocess/package.json";
import * as svelte from "svelte/compiler";
import { version as svelteVersion } from "svelte/package.json";
import { prettier } from "./prettier";
import { SvelteConfig } from "./deps/svelte-language-server/src/lib/documents/configLoader";

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

globalThis.__dirname = "/";

// @ts-expect-error patching require
globalThis.require = function (req) {
  if (throwIfRequire.hasOwnProperty(req))
    throw Error("Cannot require module " + req + ".");

  for (const imp of Object.keys(required)) {
    if (typeof req === "string" && imp === req) {
      const m = required[imp];
      if (req.endsWith(".json")) return m;
      else return m;
    } else if (
      typeof req === "string" &&
      req.startsWith(".") &&
      imp.startsWith(".") &&
      path.resolve(req).includes(path.resolve(imp))
    ) {
      const m = required[imp];
      if (req.endsWith(".json")) return m;
      else return m;
    }
  }
  console.debug("dynamic required missing", req);
};

// patching LN#47 in src/deps/svelte-language-server/src/lib/documents/configLoader.ts
const _Function = new Proxy(Function, {
  construct(target, argArray, newTarget) {
    if (argArray.join("") === "modulePathreturn import(modulePath)")
      return (x) => {
        const processor = {};
        const reqPreProcess = globalThis.__importDefault(`svelte-preprocess`);
        console.log({ reqPreProcess });

        for (const key in reqPreProcess.default) {
          processor[key] = `${reqPreProcess.default[key].toString()}`;
        }
        console.log({ processor });
        // convert processor to a base64 string, while keeping the functions intact
        const processorString = `export default () => (${JSON.stringify(
          processor
        )})`;
        console.log({ processorString });

        // convert the data url into a object url
        const processorObjectUrl = URL.createObjectURL(
          new Blob([processorString], { type: "application/javascript" })
        );

        /** @vite-ignore */
        return import(
          `data:application/javascript;base64,${btoa(
            x.replace("'svelte-preprocess';", `'${processorObjectUrl}';`)
          )}`
        );
      };
  },
  apply(target, thisArg, args) {
    if (args.join("") === "return this") {
      return function () {
        return this;
      };
    }

    return new GLOBAL_FUNCTION(...arguments);
  },
});

const compilerOptions: CompilerOptions = {
  ...ts.getDefaultCompilerOptions(),
  allowNonTsExtensions: true,
  allowJs: true,
  checkJs: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ESNext,
};

globalThis.__importStar = (req) => {
  return req;
};

globalThis._importScripts = function (...args: any[]) {
  console.debug("Trying to import a script", args);
};

const required = {
  "prettier/package.json": { version: prettierVersion },
  "svelte/package.json": { version: svelteVersion },
  "svelte-preprocess/package.json": preprocessJSON,
  "/node_modules/svelte-preprocess/package.json": preprocessJSON,
  "/node_modules/svelte/package.json": { version: preprocess_version },
  "svelte-preprocess/autoProcess.js": preprocess,
  "/node_modules/svelte-preprocess": preprocess.sveltePreprocess,
  "svelte-preprocess": preprocess,
  fs,
  "graceful-fs": fs,
  typescript: ts,
  "../transformers/typescript.js": { transformer: transformerTS.transformer },
  "./transformers/typescript": { transformer: transformerTS.transformer },
  "./transformers/postcss.js": {
    transformer: transformerPOSTCSS.transformer,
  },
  "./transformers/scss.js": { transformer: transformerSCSS.transformer },
  "./transformers/less.js": { transformer: transformerLess.transformer },
  "./transformers/globalStyle": {
    transformer: transformerGlobalStyle.transformer,
  },
  "./transformers/babel": { transformer: transformerBabel.transformer },
  "svelte/compiler": { ...svelte },
  postcss: { ...postcss, default: postcss },
  "/node_modules/svelte/compiler": { ...svelte },
  "/node_modules/prettier/package.json": { version: "2.8.6" },
  svelte2tsx: "/node_modules/svelte2tsx/index.js",
  "/node_modules/prettier": prettier,
  "svelte/compiler.cjs": { ...svelte },
  "svelte/compiler.js": svelte,
  "/prettier": prettier,
  "/prettier/": prettier,
};

// const conf: SvelteConfig = {
//   preprocess: [
//     ppts({
//       compilerOptions,
//       tsconfigDirectory: "/",
//       tsconfigFile: "/tsconfig.json",
//     }),
//   ], // ppts.default({
//   // 	tsconfigFile: "/tsconfig.json",
//   // 	tsconfigDirectory: "/",
//   // 	compilerOptions,
//   // }),
//   // ],
// };
// setConfigLoader("getConfig", conf);

globalThis.__importDefault = function (req) {
  return { default: require(req) };
};

// @ts-expect-error patching require.resolve
globalThis.require.resolve = (x) =>
  x in required && x === "svelte2tsx"
    ? (required[x] as string)
    : path.resolve(x.includes("node_modules") ? x : `/node_modules/${x}`);
globalThis.importSvelte = required["svelte/compiler"];
globalThis.importSveltePreprocess = () => required["svelte-preprocess"];

const throwIfRequire = {
  "./node_modules/@microsoft/typescript-etw": true,
  "svelte-native/package.json": true,
};

export { _Function };
