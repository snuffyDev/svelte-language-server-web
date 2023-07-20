//@ts-nocheck
import "./preshim";
import "./fs";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	createConnection,
} from "vscode-languageserver//browser";

const worker: Worker = _self as any;

const conn = createConnection(
	new BrowserMessageReader(worker),
	new BrowserMessageWriter(worker),
);

import { startServer } from "./deps/svelte-language-server/src/server";

addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

// Start the
try {
	startServer({ connection: conn });
} catch (e) {
	console.log({ eRROR: e });
}
