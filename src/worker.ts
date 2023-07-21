import "./prelude";
import "./global_patches";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	createConnection,
} from "vscode-languageserver/browser";

const worker = globalThis as unknown as WindowOrWorkerGlobalScope;

const conn = createConnection(
	new BrowserMessageReader(worker),
	new BrowserMessageWriter(worker),
);

import { startServer } from "./deps/svelte-language-server/src/server";

addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

// Start the language server
export default () => {
	try {
		startServer({ connection: conn });
	} catch (e) {
		console.log({ eRROR: e });
	}
};
