# svelte-language-server-web

Svelte language server within a web worker.

Based on/inspired by: https://github.com/asafamr/monaco-svelte/

## Features

- Uses latest packages for `typescript`, `svelte`, `svelte-preprocess`, etc.
- Editor-agnostic, use with Monaco, VSCode Web, CodeMirror...
- Supports SvelteKit
  - also supports SvelteKit's auto-generated type definitions for your routes and endpoints!
- Works fully like you'd expect!
- Path aliases (`$lib/`, `@/`, or anything defined in `tsconfig.json/jsconfig.json`)
- Automatic type acquisition (ATA)
  - You must send a `package.json` file (as an object) to the Worker for this feature to work.
- TypeScript Language Server (for `.js/.ts` file intellisense)

## How it works

The core of all of this is the `module_shims` directory. Therein lies most of the custom code, such as the `fs` module which is used and injected wherever `fs` is imported. Essentially this repo emulates Node.js wherever it can, otherwise it will just do a barebones shim so that 'it works'.

However, good news is, there shouldn't be many pain points. As far as I've tested, all functionality works just like in the official Svelte Language Server!

## Demo

Need convinced? [Try it out here!](https://svelte-language-server-web.vercel.app/)

_(demo uses CodeMirror 6, paired with https://github.com/FurqanSoftware/codemirror-languageserver)_

## Usage

Creating the Svelte Language Server worker:

```ts
// /worker.ts
import { SvelteLanguageWorker } from "svelte-language-server-web/worker";

export default SvelteLanguageWorker();
```

Creating the TypeScript Language Server worker:

```ts
// /tsWorker.ts
import { TypeScriptWorker } from "svelte-language-server-web/tsWorker";

export default TypeScriptWorker();
```

Using the worker (CodeMirror 6):

```ts
import { WorkerRPC } from "svelte-language-server-web";

const files = {
  "/package.json": "...", // package.json as a string
  "/tsconfig.json": "...", // tsconfig.json as a string
  "/src/App.svelte": "...", // Svelte Component as a string
  // .. rest of your files
};

// setup the svelte worker
const svelteWorker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

// setup the typescript worker
const tsWorker = new Worker(new URL("./tsWorker.ts", import.meta.url), {
  type: "module",
});

const svelteLanguageServer = new WorkerRPC(svelteWorker, {
  rootUri: null,
  workspaceFolders: null,
  // full options can be found here: https://github.com/FurqanSoftware/codemirror-languageserver/blob/master/src/index.ts#L466-L476
});

const tsLanguageServer = new WorkerRPC(tsWorker, {
  rootUri: null,
  workspaceFolders: null,
});

await Promise.all([
  /**
   * fetch the type definitions for your dependencies
   * (can be called at any time to fetch type definitions for packages on-demand)
   */
  svelteLanguageServer.fetchTypes(files["/package.json"]),
  tsLanguageServer.fetchTypes(files["/package.json"]),

  /**
   * add your project's files
   * (can be called at any time to add files on-demand)
   */
  svelteLanguageServer.addFiles(files),
  tsLanguageServer.addFiles(files),

  // setup and finish setup
  svelteLanguageServer.setup(files),
  tsLanguageServer.setup(files),
]);

// create the EditorState per document
const state = EditorState.create({
  doc: files["/src/App.svelte"],
  extensions: [
    languageServerWithTransport({
      transport: svelteLanguageServer,
      documentUri: "file:///src/App.svelte", // documentUri must start with `file:///`
      languageId: "svelte",
      workspaceFolders: null,
      rootUri: "file:///",
      allowHTMLContent: true,
      autoClose: false,
      client: svelteLanguageServer.client(),
    }),
  ],
});

// Create the editor with basic setup and Svelte + TypeScript language server integration
const editor = new EditorView({
  state,
  parent: document.getElementById("editor")!,
  extensions: [],
});
```

More complete examples of usage can be found in `/examples` within the repository.
