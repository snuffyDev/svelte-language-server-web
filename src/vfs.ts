import type { Encoding } from "crypto";

import EventEmitter from "events";
import {
	WatchEventType,
	type WatchOptions,
	type WatchListener,
	type FSWatcher as _FSWatcher,
} from "fs";
import process from "process";
import {
	ParsedTsconfig,
	type FileWatcher,
	type FileWatcherCallback,
	DirectoryWatcherCallback,
} from "typescript";
import _path from "./deps/path-deno";
import json from "./libs.json";
type EventListener = (
	eventType: WatchEventType | "close" | "error",
	filename: string | Buffer,
) => void;

enum FileType {
	File,
	Directory,
	SymbolicLink,
}

const sys = new Map<string, { content: string; type: FileType }>();
const watchFiles: Map<
	string,
	{
		path: string;
		callback: WatchListener<string>;
		pollingInterval?: number;
		options?: WatchOptions;
	}
> = new Map();
const watchDirectories: Map<
	string,
	{
		path: string;
		callback: DirectoryWatcherCallback;
		recursive?: boolean;
		options?: WatchOptions;
	}
> = new Map();

const directories = new Set();

class FSWatcherImpl extends EventEmitter.EventEmitter implements _FSWatcher {
	private listener: WatchListener<string>;
	private path: string;
	private watching: boolean;

	constructor(
		path: string,
		private options: WatchOptions | Encoding,
		listener: WatchListener<string>,
	) {
		super();
		this.path = VFSImpl.normalize(path);
		this.listener = listener;
		this.watching = false;

		this.startWatching();

		this.handleFileChange = this.handleFileChange.bind(this);
	}

	public close() {
		this.listener = () => {}; // Clear the listener
		this.removeAllListeners();
		this.watching = false;
	}

	private startWatching() {
		if (this.watching) return;
		this.watching = true;

		const handleFileChange = this.handleFileChange.bind(this);
		VFSImpl.on("change", handleFileChange);
	}

	private handleFileChange(eventType: string, changedPath: string) {
		console.log(eventType, changedPath);

		if (
			(changedPath !== "/" && this.path.startsWith(changedPath)) ||
			changedPath === this.path
		) {
			const filename = changedPath;
			this.listener(eventType as never, filename);
			this.emit(eventType, filename);
		}
	}
}

export const FSWatcher: new (
	path: string,
	options: WatchOptions | Encoding,
	listener: EventListener,
) => _FSWatcher = FSWatcherImpl as any;

class VFSImpl {
	private static symlinkMap: Map<string, string> = new Map();
	private static tsConfigPaths: ParsedTsconfig["options"]["paths"] = {};
	public static handlers: Map<string, EventListener[]> = new Map();

	// Maps symlink paths to their targets
	public static readonly output: string[] = [];

	public static emit = <T extends WatchEventType | "close" | "error">(
		event: T,
		name: string,
	): boolean => {
		const handlers = VFSImpl.handlers.get(event) ?? [];
		for (const handler of handlers) {
			handler(event, name);
		}
		return true;
	};
	public static eventNames = [...this.handlers.keys()];
	public static getCurrentDirectory = () => {
		// console.log({ getCurrentDirectory: "/" });

		return "/";
	};
	public static getExecutingFilePath = () => {
		return "/" || process.execPath;
	};
	public static listenerCount = (event: string) => {
		return VFSImpl.handlers.get(event)?.length ?? 0;
	};
	public static off = (event: string, callback: EventListener) => {
		const handlers = VFSImpl.handlers.get(event) ?? [];
		const index = handlers.indexOf(callback);
		if (index > -1) {
			handlers.splice(index, 1);
		}
		VFSImpl.handlers.set(event, handlers);
	};
	public static on = (event: string, callback: EventListener) => {
		const handlers = VFSImpl.handlers.get(event) ?? [];
		handlers.push(callback);
		VFSImpl.handlers.set(event, handlers as unknown as EventListener[]);
	};
	public static tsConfig: { compilerOptions: ParsedTsconfig["options"] };

	// VFS Methods
	public static createDirectory(path: string) {
		// console.log({ createDirectory: path });
		this.emit("change", _path.posix.dirname(VFSImpl.normalize(path)));

		return directories.add(VFSImpl.normalize(path));
	}

	public static directoryExists(path: string) {
		// console.log({ directoryExists: path });
		return directories.has(VFSImpl.normalize(path));
	}

	public static exit(exitCode?: number) {
		return 1;
	}

	public static fileExists(path: string) {
		if (!path.includes("node_modules")) {
			// console.error(new Error(path).stack);
			// console.log({
			// 	fileExists: path,
			// 	exists: sys.has(VFSImpl.normalize(path)),
			// });
		}
		return sys.has(VFSImpl.normalize(path));
	}

	public static getDirectories(path: string) {
		// console.log([...directories.keys()]);
		return [...directories.keys()];
	}

	public static isSymlink(path: string) {
		const normalizedPath = VFSImpl.normalize(path);
		return VFSImpl.symlinkMap.has(normalizedPath);
	}

	public static normalize(path: string) {
		return _path.posix.normalize(
			_path.posix.fromFileUrl(
				path.startsWith("file:///")
					? path
					: new URL(_path.posix.toFileUrl(_path.posix.resolve(path))),
			),
		);
	}

	public static readDirectory(
		path: string,
		_extensions?: readonly string[],
		_exclude?: readonly string[],
		_include?: readonly string[],
		_depth?: number,
	) {
		const test = Array.from(sys.keys())
			.map((v) => {
				const normalized = VFS.normalize(v);
				for (const key in VFS.tsConfigPaths) {
					if (
						normalized.startsWith(key) ||
						key.startsWith(normalized.slice(1))
					) {
						path = normalized.slice(1).replace(key, VFS.tsConfigPaths[key][0]);
						return path;
					}
				}
				return (
					(path.startsWith(normalized) || normalized.startsWith(path)) &&
					normalized
				);
			})
			.filter(Boolean);
		// console.log({ path, test });

		return test;
	}

	public static readFile(path: string, encoding?: string) {
		try {
			const test =
				sys.get(VFSImpl.normalize(path)) ||
				sys.get(VFSImpl.normalize(path.replace("/", "/node_modules/lib/lib.")));

			// console.log({ path, encoding, test });
			return encoding?.startsWith("utf")
				? test.content
				: encoding
				? test.content
				: Buffer.from(test.content);
		} catch {
			return undefined;
		}
	}

	public static readlink(path: string) {
		const normalizedPath = VFSImpl.normalize(path);
		return VFSImpl.symlinkMap.get(normalizedPath) || null;
	}

	public static resolvePath(path: string) {
		directories.add(_path.posix.dirname(VFSImpl.normalize(path)));
		return VFSImpl.normalize(_path.posix.resolve(path));
	}

	public static symlink(target: string, path: string, type: string = "file") {
		// For simplicity, assume symlinks are only created to files
		const normalizedTarget = VFSImpl.normalize(target);
		const normalizedPath = VFSImpl.normalize(path);

		if (!VFSImpl.fileExists(normalizedTarget)) {
			throw new Error(`Target ${normalizedTarget} does not exist`);
		}

		sys.set(normalizedPath, normalizedTarget);
		VFSImpl.symlinkMap.set(normalizedPath, normalizedTarget);
	}

	public static unlink(path: string) {
		const normalizedPath = VFSImpl.normalize(path);

		if (!sys.has(normalizedPath) && !VFSImpl.isSymlink(normalizedPath)) {
			throw new Error(`File or symlink ${normalizedPath} not found`);
		}

		sys.delete(normalizedPath);
		VFSImpl.symlinkMap.delete(normalizedPath);
	}

	public static write(s: string) {
		return VFSImpl.output.push(s);
	}

	public static writeFile(
		path: string,
		data: string,
		writeByteOrderMark?: boolean,
	) {
		const normalizedPath = VFSImpl.normalize(path);
		directories.add(_path.posix.dirname(normalizedPath));

		// Find the root `tsconfig`
		// TODO: jsconfig support
		if (
			!normalizedPath.includes("node_modules") &&
			(normalizedPath.endsWith("/tsconfig.json") ||
				normalizedPath.endsWith("/jsconfig.json"))
		) {
			try {
				const tsconfig = JSON.parse(
					Buffer.from(data as string)
						.toString("utf-8")
						.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
							g ? "" : m,
						),
				);
				VFS.tsConfig = tsconfig;
				VFS.tsConfigPaths = tsconfig?.compilerOptions?.paths || {};
			} catch (err) {
				console.error(err);
				console.debug({ path, data, writeByteOrderMark });
			}
		}
		return sys.set(normalizedPath, { content: data, type: FileType.File });
	}
}

/* Create an in-memory file watcher */
class VFSWithFileTreeAndDirectorySupport extends VFSImpl {
	public static watchDirectory = (
		path: string,
		callback: DirectoryWatcherCallback,
		recursive?: boolean,
		options?: WatchOptions,
	) => {
		const normalizedPath = VFSImpl.normalize(path);
		const watcher = watchDirectories.get(normalizedPath);
		if (watcher) {
			watcher.callback = callback;
			watcher.options = options;
			watcher.recursive = recursive;
		} else {
			watchDirectories.set(normalizedPath, {
				path,
				callback,
				options,
				recursive,
			});
		}
		return new FSWatcher(normalizedPath, options, callback);
	};
	public static watchers: Map<string, _FSWatcher> = new Map();

	public static unwatchDirectory(
		path: string,
		callback?: DirectoryWatcherCallback,
	) {
		const watcher = watchDirectories.get(VFSImpl.normalize(path));
		if (watcher) {
			watchDirectories.delete(VFSImpl.normalize(path));
		}
	}

	public static unwatchFile(path: string, callback?: FileWatcherCallback) {
		const watcher = VFSWithFileTreeAndDirectorySupport.watchers.get(
			VFSImpl.normalize(path),
		);
		if (watcher) {
			watcher.close();
			VFSWithFileTreeAndDirectorySupport.watchers.delete(
				VFSImpl.normalize(path),
			);
		}
	}

	public static watchFile(
		path: string,
		options: WatchOptions,
		callback?: WatchListener<string>,
	) {
		const normalizedPath = VFSImpl.normalize(path);
		const watcher = watchFiles.get(normalizedPath);
		if (watcher) {
			watcher.callback = callback;
			watcher.options = options;
		} else {
			watchFiles.set(normalizedPath, { path, callback, options });
		}
		return new FSWatcher(normalizedPath, options, callback);
	}
}

export var VFS = VFSWithFileTreeAndDirectorySupport;
const fsMap = new Map(
	Object.entries(json).map(([key, value]) => [
		_path.posix.resolve(`/node_modules/typescript/lib/`, key),
		value,
	]),
);

VFSImpl.writeFile(
	"file:///svelte.config.js",
	`
import preprocess from 'svelte-preprocess';
export default {
	// Consult https://svelte.dev/docs#compile-time-svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),
  }
`,
);

// Create the tsConfig (should be done somewhere else!)
if (!VFSImpl.fileExists("/tsconfig.json"))
	VFSImpl.writeFile(
		"/tsconfig.json",
		`{
	"compilerOptions": {
		"target": "ESNext",
		"useDefineForClassFields": true,
		"module": "ESNext",
		"lib": ["ES2020","ESNext", "DOM", "DOM.Iterable"],

		/* Bundler mode */
		"moduleResolution": "Node",
		"resolveJsonModule": true,
		"isolatedModules": true,
		"noEmit": true,
		"strict": true,
		"noUnusedLocals": true,
		"skipLibCheck": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true
	}
}
`,
	);

// SET SVELTE DEFINITIONS
const files = import.meta.glob("/node_modules/svelte/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in files) {
	VFSImpl.writeFile(file, files[file]);
}

// SET SVELTE2TSX DEFINITIONS
const filesS2TSX = import.meta.glob("/node_modules/svelte2tsx/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in filesS2TSX) {
	VFSImpl.writeFile(file, filesS2TSX[file]);
}

// SET PREPROCESS DEFINITIONS
const preprocess = import.meta.glob(
	"/node_modules/svelte-preprocess/dist/**/*.d.ts",
	{
		eager: true,
		as: "raw",
	},
);
for (const file in preprocess) {
	VFSImpl.writeFile(file, preprocess[file]);
}

fsMap.forEach((value, key) => {
	console.log({ value, key });
	VFSImpl.writeFile(`/node_modules/typescript/lib/${key}`, value);
});
console.log({ sys });
