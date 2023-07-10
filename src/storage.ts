//@ts-nocheck
import { Thread, ThreadArgs } from "nanothreads";
import type { StorageOperation } from "./services/storageImpl.js";
const StorageURL = new URL("./services/storageImpl.js", import.meta.url);

export const globalStorage = new Thread<
	ThreadArgs<
		[
			operation: "get" | "set" | "delete" | "clear",
			key: string | never,
			value: string | never,
		]
	>,
	string | null | void
>(new URL(StorageURL, import.meta.url), {
	type: "module",
	maxConcurrency: 1,
});
