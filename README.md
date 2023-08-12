# svelte-language-server-web

Svelte language server within a web worker.

Based on/inspired by: https://github.com/asafamr/monaco-svelte/

## Features

- Uses latest packages for TS, Svelte, svelte-preprocess, etc.
- Editor-agnostic, use with Monaco, VSCode Web, CodeMirror...
- Works (almost) fully like you'd expect!
- Path aliases (`$lib/`, `@/`, or anything defined in `tsconfig.json/jsconfig.json`)

## How it works

The core of all of this is the `module_shims` directory. Therein lies most of the custom code, such as the `fs` module which is used and injected wherever `fs` is imported. Essentially this repo emulates Node.js wherever it can, otherwise it will just do a barebones shim so that 'it works'.



## Demo

Need convinced? [Try it out here!](https://cm-lsp.vercel.app/)

_(demo uses CodeMirror 6, paired with https://github.com/FurqanSoftware/codemirror-languageserver)_
