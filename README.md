# svelte-language-server-web

Svelte language server within a web worker.

Based on/inspired by: https://github.com/asafamr/monaco-svelte/

## Features

- Uses latest packages for TS, Svelte, svelte-preprocess, etc.
- Editor-agnostic, use with Monaco, VSCode Web, CodeMirror...
- Works (almost) fully like you'd expect!
- Path aliases (`$lib/`, `@/`, or anything defined in `tsconfig.json/jsconfig.json`)
- Automatic type acquisition (ATA)
  - You must send a `package.json` file (parsed) to the Worker for this feature to work.
- TypeScript Language Server (for `.js/.ts` file intellisense)

## How it works

The core of all of this is the `module_shims` directory. Therein lies most of the custom code, such as the `fs` module which is used and injected wherever `fs` is imported. Essentially this repo emulates Node.js wherever it can, otherwise it will just do a barebones shim so that 'it works'.

## Demo

Need convinced? [Try it out here!](https://cm-lsp.vercel.app/)

_(demo uses CodeMirror 6, paired with https://github.com/FurqanSoftware/codemirror-languageserver)_

## Usage

Creating a worker:

```ts
// /worker.ts
import { SvelteLanguageWorker } from "svelte-language-server-web";

export default SvelteLanguageWorker();
```

Using the worker:

```ts
import { WorkerRPC } from "svelte-language-server-web";

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
const rpc = new WorkerRPC(worker, { rootUri: null, workspaceFolders: null }); // options: https://github.com/FurqanSoftware/codemirror-languageserver/blob/master/src/index.ts#L466-L476
```

Full example can be found in `/main.ts` at the root of the repo ([here](https://github.com/snuffyDev/svelte-language-server-web/blob/main/main.ts))
