# TypeScript Language Server Worker

Here is the core of the TypeScript language server, which is intended specficially for `.js/.ts` module files.

There's duplicated functions, classes, etc., however when importing should-be shared code from `src/deps/svelte-language-server`, there's a risk for the TypeScript Language Server and the Svelte Language Server to "clash" (?)

All I know for sure is, the duplicated code saves a lot of potential headaches since both of the TS language server and the Svelte language server run in separate workers (threads)
