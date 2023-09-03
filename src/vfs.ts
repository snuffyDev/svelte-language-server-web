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
	type FileWatcherCallback,
	DirectoryWatcherCallback,
} from "typescript";
import _path from "./deps/path-deno";
import json from "./libs.json";
import { addKitToDefaultExport, extractKitProperty } from "./vfs.utils";
import { syncFiles } from "./features/workspace";

type EventListener = (
	eventType: WatchEventType | "close" | "error",
	filename: string | Buffer,
) => void;

enum FileType {
	File,
	Directory,
	SymbolicLink,
}

export const sys = new Map<string, { content: string; type: FileType }>();
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
		this.path = VFS.normalize(path);
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
		VFS.on("change", handleFileChange);
	}

	private handleFileChange(eventType: string, changedPath: string) {
		// handle file changes just like the fs.watchFile handler
		const watcher = watchFiles.get(this.path);
		if (watcher) {
			if (watcher.callback) {
				watcher.callback(eventType as WatchEventType, changedPath);
			}
			if (watcher.options?.persistent === false) {
				watchFiles.delete(this.path);
			}
		}
		// handle directory changes just like the fs.watch handler
		const dirWatcher = watchDirectories.get(this.path);
		if (dirWatcher) {
			if (dirWatcher.callback) {
				dirWatcher.callback(changedPath);
			}
			if (dirWatcher.options?.persistent === false) {
				watchDirectories.delete(this.path);
			}
		}
	}
}

export const FSWatcher: new (
	path: string,
	options: WatchOptions | Encoding,
	listener: EventListener,
) => _FSWatcher = FSWatcherImpl as any;

class VFSImpl extends EventEmitter.EventEmitter {
	// Maps symlink paths to their targets
	private symlinkMap: Map<string, string> = new Map();
	private tsConfigPaths: ParsedTsconfig["options"]["paths"] = {};

	public readonly output: string[] = [];

	public getCurrentDirectory = () => {
		return "/";
	};
	public getExecutingFilePath = () => {
		return "/" || process.execPath;
	};

	public tsConfig: { compilerOptions: ParsedTsconfig["options"] };

	// VFS Methods
	public createDirectory(path: string) {
		this.emit("change", _path.posix.dirname(this.normalize(path)));

		return directories.add(this.normalize(path));
	}

	public directoryExists(path: string) {
		return directories.has(this.normalize(path));
	}

	public exit(exitCode?: number) {
		return 1;
	}

	public fileExists(path: string) {
		return sys.has(this.normalize(path));
	}

	public getDirectories(path: string) {
		return [...directories.keys()] as string[];
	}

	public isSymlink(path: string) {
		const normalizedPath = this.normalize(path);
		return this.symlinkMap.has(normalizedPath);
	}

	public normalize(path: string) {
		return _path.posix.normalize(
			_path.posix.fromFileUrl(
				path.startsWith("file:///")
					? path
					: new URL(_path.posix.toFileUrl(_path.posix.resolve(path))),
			),
		);
	}

	public readDirectory(
		path: string,
		extensions?: readonly string[],
		exclude?: readonly string[],
		include?: readonly string[],
		depth?: number,
	) {
		const normalizedPath = this.normalize(path);

		let files = [...sys.keys()].filter((file) =>
			file.startsWith(normalizedPath),
		);

		if (extensions) {
			files = files.filter((file) =>
				extensions.some((extension) => file.endsWith(extension)),
			);
		}

		if (exclude) {
			files = files.filter(
				(file) => !exclude.some((excluded) => file.includes(excluded)),
			);
		}

		if (include) {
			files = files.filter((file) =>
				include.some((included) => file.includes(included)),
			);
		}

		if (depth) {
			files = files.filter((file) => {
				const fileDepth = file.split("/").length;
				const pathDepth = normalizedPath.split("/").length;
				return fileDepth - pathDepth <= depth;
			});
		}

		return files;
	}

	public readFile(path: string, encoding: string = "utf-8") {
		try {
			const test =
				sys.get(this.normalize(path)) ||
				sys.get(this.normalize(path.replace("/", "/node_modules/lib/lib.")));

			return encoding?.startsWith("utf")
				? test.content
				: encoding
				? test.content
				: Buffer.from(test.content);
		} catch {
			return undefined;
		}
	}

	public readlink(path: string) {
		const normalizedPath = this.normalize(path);
		return this.symlinkMap.get(normalizedPath) || null;
	}

	public resolvePath(path: string, ...rest) {
		directories.add(_path.posix.dirname(this.normalize(path)));
		return this.normalize(_path.posix.resolve(path, ...rest));
	}

	public symlink(target: string, path: string, type: string = "file") {
		// For simplicity, assume symlinks are only created to files
		const normalizedTarget = this.normalize(target);
		const normalizedPath = this.normalize(path);

		if (!this.fileExists(normalizedTarget)) {
			throw new Error(`Target ${normalizedTarget} does not exist`);
		}

		sys.set(normalizedPath, normalizedTarget);
		this.symlinkMap.set(normalizedPath, normalizedTarget);
	}

	public unlink(path: string) {
		const normalizedPath = this.normalize(path);

		if (!sys.has(normalizedPath) && !this.isSymlink(normalizedPath)) {
			throw new Error(`File or symlink ${normalizedPath} not found`);
		}

		sys.delete(normalizedPath);
		this.symlinkMap.delete(normalizedPath);
	}

	public write(s: string) {
		return this.output.push(s);
	}

	public writeFile(path: string, data: string, writeByteOrderMark?: boolean) {
		const normalizedPath = this.normalize(path);
		directories.add(_path.posix.dirname(normalizedPath));
		if (normalizedPath.includes("svelte.config.")) {
			const kit = extractKitProperty(data);
			if (kit) {
				const baseModule = getBaseSvelteConfig();
				const newConfig = addKitToDefaultExport(baseModule, kit).replace(
					/adapter: .[\w\(\{\}\)\,]+?(\n|\t)/gm,
					"adapter:()=> {}",
				);
				return sys.set(normalizedPath, {
					content: newConfig,
					type: FileType.File,
				});
			}
		}
		// Find the root `tsconfig`
		// TODO: jsconfig support
		return sys.set(normalizedPath, { content: data, type: FileType.File });
	}
}

/* Create an in-memory file watcher */
class VFSWithFileTreeAndDirectorySupport extends VFSImpl {
	public watchDirectory = (
		path: string,
		callback: DirectoryWatcherCallback,
		recursive?: boolean,
		options?: WatchOptions,
	) => {
		const normalizedPath = this.normalize(path);
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
	public watchers: Map<string, _FSWatcher> = new Map();

	public unwatchDirectory(path: string, callback?: DirectoryWatcherCallback) {
		const watcher = watchDirectories.get(this.normalize(path));
		if (watcher) {
			watchDirectories.delete(this.normalize(path));
		}
	}

	public unwatchFile(path: string, callback?: FileWatcherCallback) {
		const watcher = this.watchers.get(this.normalize(path));
		if (watcher) {
			watcher.close();
			this.watchers.delete(this.normalize(path));
		}
	}

	public watchFile(
		path: string,
		options: WatchOptions,
		callback?: WatchListener<string>,
	) {
		const normalizedPath = this.normalize(path);
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

export var VFS = new VFSWithFileTreeAndDirectorySupport();

const fsMap = new Map(
	Object.entries(json).map(([key, value]) => [
		_path.posix.resolve(`/node_modules/typescript/lib/`, key),
		value,
	]),
);

VFS.writeFile("file:///svelte.config.js", getBaseSvelteConfig());

// Create the tsConfig (should be done somewhere else!)
if (!VFS.fileExists("/tsconfig.json"))
	VFS.writeFile(
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
	VFS.writeFile(file, files[file]);
}

// SET SVELTE2TSX DEFINITIONS
const filesS2TSX = import.meta.glob("/node_modules/svelte2tsx/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in filesS2TSX) {
	VFS.writeFile(file, filesS2TSX[file]);
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
	VFS.writeFile(file, preprocess[file]);
}

fsMap.forEach((value, key) => {
	VFS.writeFile(`/node_modules/typescript/lib/${key}`, value);
});

function getBaseSvelteConfig(): string {
	return `
import preprocess from 'svelte-preprocess';
export default {
	// Consult https://svelte.dev/docs#compile-time-svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess({ typescript: true }),
  }
`;
}
