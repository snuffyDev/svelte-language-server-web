import "./fs";
export { startServer } from "./server";
export * from "./transport";
export * from "./vfs";

export const createWorker = () => {
	return new Worker(new URL("./worker.ts", import.meta.url), {
		type: "module",
	});
};
