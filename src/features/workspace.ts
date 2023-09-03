import { VFS } from "../vfs";
import { batchUpdates } from "../utils";

class TypedBroadcastChannel<T> extends BroadcastChannel {
	constructor(name: string) {
		super(name);
	}
	postMessage(message: T): void {
		super.postMessage(message);
	}
	onmessage: (message: MessageEvent<T>) => void;
	addEventListener: (
		type: "message",
		listener: (message: MessageEvent<T>) => void,
	) => void = super.addEventListener;
}

type File = [name: string, contents: string];
const BC = new TypedBroadcastChannel<File[]>("sync-channel");

function removeDuplicateFiles(files: File[]): File[] {
	const fileMap = new Map<string, File>();

	for (const [name, contents] of files) {
		// Only store the latest entry for each filename
		fileMap.set(name, [name, contents]);
	}

	return Array.from(fileMap.values());
}

export const syncFiles = batchUpdates<[name: string, contents: string]>(
	(files) => {
		BC.postMessage(removeDuplicateFiles(files));
	},
	20,
	500,
);

export const handleFSSync = (
	callback: (fileName: string, contents: string) => void,
) => {
	BC.onmessage = (event) => {
		for (const [name, contents] of event.data) {
			VFS.writeFile(name, contents);
			callback(name, contents);
		}
	};
};
