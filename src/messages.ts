export const workerRPCMethods = [
	"@@setup",
	"@@add-files",
	"@@fetch-types",
] as const;
export type WorkerRPCMethod = (typeof workerRPCMethods)[number];

type URI = string;
type FileContents = string;

type WorkerMessage<T extends WorkerRPCMethod> = {
	method: T;
	params: Record<URI, FileContents>;
};

type SetupMessage = WorkerMessage<"@@setup">;

type AddFilesMessage = WorkerMessage<"@@add-files">;
type FetchTypesMessage = WorkerMessage<"@@fetch-types">;

export type { FetchTypesMessage, WorkerMessage, SetupMessage, AddFilesMessage };

export const createWorkerMessage = <T extends WorkerRPCMethod>(
	method: "setup" | "add-files" | "fetch-types",
	params: WorkerMessage<T>["params"],
): WorkerMessage<T> => ({
	method: `@@${method}` as T,
	params,
});
