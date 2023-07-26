import "./prelude";
import "./global_patches";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	createConnection,
} from "vscode-languageserver/browser";

const worker = globalThis as unknown as DedicatedWorkerGlobalScope;

const conn = createConnection(
	new BrowserMessageReader(worker),
	new BrowserMessageWriter(worker),
);

import { startServer } from "./server";
import { VFS } from "./vfs";

addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

// Start the language server
export default () => {
	try {
		addEventListener(
			"message",
			(event) => {
				console.log({
					isSetup: event.data?.method === "setup",
					data: event.data,
				});
				for (const key in event.data?.params) {
					VFS.writeFile(key, event.data?.params[key] as string);
				}
				startServer({ connection: conn });
			},
			{ once: true },
		);
	} catch (e) {
		console.log({ eRROR: e });
	}
};
