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
import { AddFilesMessage, SetupMessage, workerRPCMethods } from "./messages";

addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

/**
 * This is the entry point for the Svelte Language Server Web Worker.
 * It will wait for a message containing any config files (svelte.config.js, tsconfig.json, etc)
 * from the main thread, and then start the server.
 *
 * @example
 * Creating the Language Server module:
 * ```ts
 * // worker.ts
 * import { SvelteLanguageWorker } from "svelte-language-server-web";
 *
 * export default SvelteLanguageWorker();
 *
 * ```
 *
 * @example
 * Using the worker:
 * ```ts
 * // main.ts
 *
 * const svelteWorker = new Worker(new URL("./worker.ts", import.meta.url), { type: 'module' });
 *
 * ```
 */
export default () => {
	let hasBeenSetup = false;
	const isRPCMessage = (
		data: unknown,
	): data is SetupMessage | AddFilesMessage =>
		data &&
		typeof data === "object" &&
		"method" in data &&
		workerRPCMethods.includes(data.method as never);

	try {
		console.log("Svelte Language Server running. Waiting for setup message.");
		addEventListener("message", function removeHandler(event) {
			if (isRPCMessage(event.data)) {
				for (const key in event.data?.params) {
					VFS.writeFile(key, event.data?.params[key] as string);
				}
				if (!hasBeenSetup) {
					hasBeenSetup = true;
					startServer({ connection: conn });
				}
			}
		});
	} catch (e) {
		console.log({ error: e });
	}
};
