import { WorkerMessage, WorkerRPCMethod } from "./messages";

/** esbuild-ignore */
export { default as SvelteLanguageWorker } from "./worker";
export * from "./rpc";

export const createWorkerMessage = <T extends WorkerRPCMethod>(
	method: "setup" | "add-files",
	params: WorkerMessage<T>["params"],
): WorkerMessage<T> => ({
	method: `@@${method}` as T,
	params,
});
