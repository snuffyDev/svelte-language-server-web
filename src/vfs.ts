import type { Encoding } from "crypto";

import EventEmitter from "events";
import {
  WatchEventType,
  type WatchOptions,
  type WatchListener,
  type FSWatcher as _FSWatcher,
} from "fs";
import {
  ParsedTsconfig,
  type FileWatcherCallback,
  DirectoryWatcherCallback,
} from "typescript";
import _path from "./deps/path-deno";
import json from "./libs.json";
import { addKitToDefaultExport, extractKitProperty } from "./vfs.utils";
import svelteTypes from "./svelte-types.json";

const SVELTEKIT_CONFIG_ADAPTER_REGEX = /adapter: .[\w\(\{\}\)\,]+?(\n|\t)/gm;

type EventListener = (
  eventType: WatchEventType | "close" | "error",
  filename: string | Buffer
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
    watcher: _FSWatcher;
    options?: WatchOptions;
  }
> = new Map();

const watchDirectories: Map<
  string,
  {
    path: string;
    callback: DirectoryWatcherCallback;
    recursive?: boolean;
    watcher: _FSWatcher;
    options?: WatchOptions;
  }
> = new Map();

const directories = new Set<string>();

class FSWatcherImpl extends EventEmitter.EventEmitter implements _FSWatcher {
  private listener: WatchListener<string>;
  private path: string;
  private watching: boolean;

  constructor(
    path: string,
    private options: WatchOptions | Encoding,
    listener: WatchListener<string>
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
    if (
      (changedPath !== "/" && this.path.includes(changedPath)) ||
      changedPath === this.path
    ) {
      const filename = changedPath;
      this.listener(eventType as never, filename);
    }
  }
}

export const FSWatcher: new (
  path: string,
  options: WatchOptions | Encoding,
  listener: EventListener
) => _FSWatcher = FSWatcherImpl as any;

class VFSImpl extends EventEmitter.EventEmitter {
  constructor() {
    super();
  }

  // Maps symlink paths to their targets
  private symlinkMap: Map<string, string> = new Map();

  public readonly output: string[] = [];

  public getCurrentDirectory = () => {
    return "/";
  };
  public getExecutingFilePath = () => {
    return "/";
  };

  public tsConfig: { compilerOptions: ParsedTsconfig["options"] };

  // VFS Methods
  public createDirectory(path: string) {
    this.emit("change", "change", this.normalize(path));
    const parts = path.split("/");
    let curPath = "/";
    for (const dir of parts) {
      curPath = _path.posix.join(curPath, dir);
      directories.add(_path.posix.join(curPath));
    }
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
    const dirs = [...directories.keys()].filter(
      (dir: string) =>
        VFS.normalize(dir).startsWith(VFS.normalize(path)) &&
        dir !== VFS.normalize(path)
    ) as string[];
    return dirs;
  }

  public isSymlink(path: string) {
    const normalizedPath = this.normalize(path);
    return this.symlinkMap.has(normalizedPath);
  }

  public normalize(path: string) {
    return _path.posix.resolve(
      _path.posix.normalize(
        _path.posix.fromFileUrl(
          path.startsWith("file:///")
            ? path
            : new URL(
                _path.posix.toFileUrl(_path.posix.resolve(path))
              ).toString()
        )
      )
    );
  }

  public readDirectoryRaw(path: string) {
    let files = [...sys.entries()]
      .filter(([name]) => name.startsWith(this.normalize(path)))
      .map(
        ([name, file]) => [name, file.type] as [name: string, type: FileType]
      );
    return files;
  }

  public readDirectory(
    path: string,
    extensions?: readonly string[],
    exclude?: readonly string[],
    include?: readonly string[],
    depth?: number
  ) {
    const normalizedPath = this.normalize(path);

    let files = [...sys.keys()].filter((file) =>
      file.startsWith(this.normalize(path))
    );

    if (extensions) {
      files = files.filter((file) =>
        extensions.some((extension) => file.endsWith(extension))
      );
    }

    if (exclude) {
      files = files.filter(
        (file) => !exclude.some((excluded) => file.includes(excluded))
      );
    }

    if (include) {
      files = files.filter((file) =>
        include.some((included) => file.includes(included))
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
      const file =
        sys.get(this.normalize(path)) ||
        sys.get(this.normalize(path.replace("/", "/node_modules/lib/lib.")));
      if (!file) throw undefined;
      return encoding?.startsWith("utf")
        ? file.content
        : encoding
        ? file.content
        : Buffer.from(file.content);
    } catch {
      return undefined;
    }
  }

  public readlink(path: string) {
    const normalizedPath = this.normalize(path);
    return this.symlinkMap.get(normalizedPath) || null;
  }

  public resolvePath(path: string, ...rest) {
    this.createDirectory(_path.posix.dirname(this.normalize(path)));
    return this.normalize(_path.posix.resolve(path, ...rest));
  }

  public symlink(target: string, path: string, type: string = "file") {
    // For simplicity, assume symlinks are only created to files
    const normalizedTarget = this.normalize(target);
    const normalizedPath = this.normalize(path);

    if (!this.fileExists(normalizedTarget)) {
      throw new Error(`Target ${normalizedTarget} does not exist`);
    }

    // @ts-expect-error it's fine
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
    this.createDirectory(_path.posix.dirname(normalizedPath));
    try {
      if (normalizedPath.includes("svelte.config.")) {
        const kit = extractKitProperty(data);

        if (kit) {
          const baseModule = getBaseSvelteConfig();
          const newConfig = addKitToDefaultExport(baseModule, kit).replace(
            SVELTEKIT_CONFIG_ADAPTER_REGEX,
            "adapter:()=> {}"
          );

          return sys.set(normalizedPath, {
            content: newConfig,
            type: FileType.File,
          });
        }
      }

      return sys.set(normalizedPath, { content: data, type: FileType.File });
    } finally {
      this.emit("change", "change", this.normalize(path));
    }
  }
}

/* VFS with in-memory file watching methods */
class VFSWithFileWatching extends VFSImpl {
  public watchDirectory = (
    path: string,
    callback: DirectoryWatcherCallback,
    recursive?: boolean,
    options?: WatchOptions
  ) => {
    const normalizedPath = this.normalize(path);
    const watcher = new FSWatcher(normalizedPath, options, callback);

    watchDirectories.set(normalizedPath, {
      path,
      callback,
      options,
      recursive,
      watcher,
    });

    return watcher;
  };
  public watchers: Map<string, _FSWatcher> = new Map();

  public unwatchDirectory(path: string, callback?: DirectoryWatcherCallback) {
    const watcher = watchDirectories.get(this.normalize(path));
    if (watcher) {
      watcher.watcher.close();
      watchDirectories.delete(this.normalize(path));
    }
  }

  public unwatchFile(path: string, callback?: FileWatcherCallback) {
    const watcher = watchFiles.get(this.normalize(path));
    if (watcher) {
      watcher.watcher.close();
      watchFiles.delete(this.normalize(path));
    }
  }

  public watchFile(
    path: string,
    options: WatchOptions,
    callback?: WatchListener<string>
  ) {
    const normalizedPath = this.normalize(path);
    const watcher = new FSWatcher(normalizedPath, options, callback);
    watchFiles.set(normalizedPath, { path, watcher, callback, options });
    return watcher;
  }
}

export var VFS = new VFSWithFileWatching();

for (const key in json) {
  const value = json[key] as string;
  VFS.writeFile(key, value);
}

VFS.writeFile("file:///svelte.config.js", getBaseSvelteConfig());

for (const key in svelteTypes) {
  const value = svelteTypes[key] as string;

  VFS.writeFile(key, value);
}

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
