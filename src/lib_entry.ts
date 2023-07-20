import "./fs";
export * from "./vfs";
export * from "./transport";
export { startServer } from "./server";

export const createWorker = () => {
	return new Worker(new URL("./worker.ts?worker&url", import.meta.url), {
		type: "module",
	});
};
