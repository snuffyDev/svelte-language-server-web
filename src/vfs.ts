import type { Encoding } from "crypto";

import EventEmitter from "events";
import {
	WatchEventType,
	type WatchOptions,
	type FSWatcher as _FSWatcher,
} from "fs";
import process from "process";
import {
	ParsedTsconfig,
	type FileWatcher,
	type FileWatcherCallback,
} from "typescript";
import _path from "./deps/path-deno";
import json from "./libs.json";

const sys = new Map<string, string>();
const directories = new Set();

type EventListener = (
	eventType: WatchEventType | "close" | "error",
	filename: string | Buffer,
) => void;

class FSWatcherImpl extends EventEmitter.EventEmitter implements _FSWatcher {
	private listener: EventListener;
	private path: string;
	private watching: boolean;

	constructor(
		path: string,
		private options: WatchOptions | Encoding,
		listener: EventListener,
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

		if (changedPath === this.path && this.listener) {
			const filename = changedPath;
			const eventType = "change";
			this.listener(eventType, filename);
			this.emit(eventType, filename);
			VFS.emit("change", filename);
		}
	}
}

export const FSWatcher: new (
	path: string,
	options: WatchOptions | Encoding,
	listener: EventListener,
) => _FSWatcher = FSWatcherImpl as any;

class VFSImpl {
	public static readonly output: string[] = [];
	public static tsConfig: { compilerOptions: ParsedTsconfig["options"] };
	private static tsConfigPaths: ParsedTsconfig["options"]["paths"] = {};

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
	public static handlers: Map<string, EventListener[]> = new Map();
	public static eventNames = [...this.handlers.keys()];

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

	// VFS Methods
	public static createDirectory(path: string) {
		this.emit("change", _path.posix.dirname(VFSImpl.normalize(path)));

		return directories.add(VFSImpl.normalize(path));
	}

	public static directoryExists(path: string) {
		return directories.has(VFSImpl.normalize(path));
	}

	public static exit(exitCode?: number) {
		return 1;
	}

	public static getCurrentDirectory = () => {
		return "/";
	};

	public static getExecutingFilePath = () => {
		return process.execPath;
	};

	public static fileExists(path: string) {
		return sys.has(VFSImpl.normalize(path));
	}

	public static getDirectories(path: string) {
		console.log([...directories.keys()]);
		return [...directories.keys()];
	}

	public static normalize(path: string) {
		return _path.posix.fromFileUrl(
			path.startsWith("file:///")
				? path
				: new URL(_path.posix.toFileUrl(_path.posix.resolve(path))),
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
		console.log({ path, test });

		return test;
	}

	public static readFile(path: string, encoding?: string) {
		try {
			const test =
				sys.get(VFSImpl.normalize(path)) ||
				sys.get(VFSImpl.normalize(path.replace("/", "/node_modules/lib/lib.")));

			console.log({ path, encoding, test });
			return encoding?.startsWith("utf")
				? test
				: encoding
				? test
				: Buffer.from(test);
		} catch {
			return undefined;
		}
	}

	public static resolvePath(path: string) {
		directories.add(_path.posix.dirname(VFSImpl.normalize(path)));
		return VFSImpl.normalize(_path.posix.resolve(path));
	}

	public static write(s: string) {
		return VFSImpl.output.push(s);
	}

	public static writeFile(
		path: string,
		data: string,
		writeByteOrderMark?: boolean,
	) {
		directories.add(_path.posix.dirname(VFSImpl.normalize(path)));
		// Find the root `tsconfig`
		// TODO: jsconfig support
		if (VFS.normalize(path).startsWith("/tsconfig.json")) {
			try {
				const tsconfig = JSON.parse(
					Buffer.from(data as string).toString("utf-8"),
				);
				VFS.tsConfig = tsconfig;
				VFS.tsConfigPaths = tsconfig.compilerOptions.paths || {};
			} catch (err) {
				console.error(err);
				console.debug({ path, data, writeByteOrderMark });
			}
		}
		this.emit("change", _path.posix.dirname(VFSImpl.normalize(path)));
		return sys.set(_path.posix.normalize(VFSImpl.normalize(path)), data);
	}
}

/* Create an in-memory file watcher */
class VFSWithFileTreeAndDirectorySupport extends VFSImpl {
	public static watchDirectory = VFSWithFileTreeAndDirectorySupport.watchFile;
	public static watchers: Map<string, _FSWatcher> = new Map();

	public static unwatchDirectory(path: string, callback?: FileWatcherCallback) {
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
		options: WatchOptions | Encoding,
		callback?: (
			event: WatchEventType | "error" | "close",
			fileName: string,
		) => void,
	): FileWatcher {
		//@ts-ignore
		const watcher = new FSWatcher(VFSImpl.normalize(path), options, callback);
		VFSWithFileTreeAndDirectorySupport.watchers.set(
			VFSImpl.normalize(path),
			watcher,
		);
		return watcher;
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
