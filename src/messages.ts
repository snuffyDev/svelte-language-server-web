export const workerRPCMethods = [
	"@@setup",
	"@@add-files",
	"@@delete-file",
	"@@fetch-types",
] as const;
export type WorkerRPCMethod = (typeof workerRPCMethods)[number];

type URI = string;
type FileContents = string;

type WorkerMessage<T extends WorkerRPCMethod> = {
	method: T;
	id: number;
	params: Record<URI, FileContents>;
};

type SetupMessage = WorkerMessage<"@@setup">;

type AddFilesMessage = WorkerMessage<"@@add-files">;
type FetchTypesMessage = WorkerMessage<"@@fetch-types">;
type DeleteFileMessage = WorkerMessage<"@@delete-file">;

type WorkerResponse<T extends WorkerRPCMethod> = {
	method: T;
	complete: boolean;
	id: number;
};

export type {
	DeleteFileMessage,
	WorkerResponse,
	FetchTypesMessage,
	WorkerMessage,
	SetupMessage,
	AddFilesMessage,
};

export const createWorkerMessage = <T extends WorkerRPCMethod>(
	method: "setup" | "add-files" | "fetch-types" | "delete-file",
	id: number,
	params: WorkerMessage<T>["params"],
): WorkerMessage<T> => ({
	method: `@@${method}` as T,
	id,
	params,
});
