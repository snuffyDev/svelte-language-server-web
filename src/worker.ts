import "./prelude";
import "./global_patches";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	createConnection,
} from "vscode-languageserver/browser";

import { startServer } from "./server";
import { VFS } from "./vfs";
import type {
	AddFilesMessage,
	FetchTypesMessage,
	SetupMessage,
	WorkerRPCMethod,
	WorkerResponse,
} from "./messages";
import { fetchTypeDefinitionsFromCDN } from "./features/autoTypings";

const worker = globalThis as unknown as DedicatedWorkerGlobalScope;

const conn = createConnection(
	new BrowserMessageReader(worker),
	new BrowserMessageWriter(worker),
);

const workerRPCMethods: ReadonlyArray<WorkerRPCMethod> = [
	"@@add-files",
	"@@setup",
	"@@fetch-types",
];

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
export const SvelteLanguageWorker = () => {
	const setupQueue = [];

	const isRPCMessage = (
		data: unknown,
	): data is SetupMessage | FetchTypesMessage | AddFilesMessage =>
		data &&
		typeof data === "object" &&
		"method" in data &&
		workerRPCMethods.includes(data.method as never);

	try {
		console.log("Svelte Language Server running. Waiting for setup message.");

		const handleFetchTypes = (data: FetchTypesMessage) => {
			VFS.writeFile("/package.json", JSON.stringify(data.params));

			return fetchTypeDefinitionsFromCDN(data.params).then((types) => {
				for (const [key, value] of types) {
					VFS.writeFile(`/node_modules/${key}/index.d.ts`, value);
				}
			});
		};
		addEventListener("setup-completed", (event) => {
			console.log({ event });
			const id = setupQueue.shift();

			if (typeof id === "number") {
				postMessage({ id, method: "@@setup", complete: true });
			}
		});
		addEventListener("message", async (event) => {
			// Process our custom RPC messages
			if (isRPCMessage(event.data)) {
				if (event.data.method === "@@fetch-types") {
					console.log({ event, json: event.data.params });
					await handleFetchTypes(event.data)
						.then(() => {
							postMessage({
								method: "@@fetch-types",
								id: event.data.id,
								complete: true,
							} as WorkerResponse<"@@fetch-types">);
						})
						.catch(console.error);
					return;
				}

				console.log({ event, json: event.data.params });
				await new Promise<void>((resolve) => {
					const fileNames = Object.keys(event.data.params);
					for (let i = 0; i < fileNames.length; i++) {
						const fileName = fileNames[i];
						const fileContents = event.data.params[fileName];

						VFS.writeFile(fileName, fileContents);
						if (i === fileNames.length - 1) {
							resolve();
						}
					}
				});

				if (event.data.method === "@@setup") {
					console.log("Setting up Svelte Language Server...");
					setupQueue.push(event.data.id);
					startServer({ connection: conn });
					postMessage({
						method: "@@setup",
						id: event.data.id,
						complete: true,
					} as WorkerResponse<"@@setup">);
				}
			}
		});
	} catch (e) {
		console.error({ error: e });
	}
};
