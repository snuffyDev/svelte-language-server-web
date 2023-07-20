import type * as _vfs from "@typescript/vfs";
import _path from "./deps/path-deno";
import ts from "typescript";
/**
 * A helper class for VFS Path Operations (writing to the TS VFS).
 *
 * Handles normalization from `file:///myFile.ts` -> `/myFile.ts`
 */
export class VFS {
	public static normalize(path: string) {
		return _path.posix.fromFileUrl(
			path.startsWith("file:///") ? path : new URL(_path.posix.toFileUrl(path)),
		);
	}

	static write = (s: string) => {
		return ts.sys.write(s);
	};
	static readFile = (path: string, encoding?: string) => {
		return ts.sys.readFile(VFS.normalize(path), encoding);
	};
	static writeFile = (
		path: string,
		data: string,
		writeByteOrderMark?: boolean,
	) => {
		return ts.sys.writeFile(
			_path.posix.normalize(VFS.normalize(path)),
			data,
			writeByteOrderMark,
		);
	};
	static resolvePath = (path: string) => {
		return ts.sys.resolvePath(VFS.normalize(path));
	};
	static fileExists = (path: string) => {
		return ts.sys.fileExists(VFS.normalize(path));
	};
	static directoryExists = (path: string) => {
		return ts.sys.directoryExists(path);
	};
	static createDirectory = (path: string) => {
		return ts.sys.createDirectory(path);
	};
	static getExecutingFilePath = () => {
		return ts.sys.getExecutingFilePath();
	};
	static getCurrentDirectory = () => {
		return ts.sys.getCurrentDirectory();
	};
	static getDirectories = (path: string) => {
		return ts.sys.getDirectories(path);
	};

	static readDirectory = (
		path: string,
		extensions?: readonly string[],
		exclude?: readonly string[],
		include?: readonly string[],
		depth?: number,
	) => {
		return (() => {
			console.log(path);
			const test = ts.sys
				.readDirectory(path, extensions, exclude, include, depth)
				.map((v) => _path.posix.toFileUrl(VFS.normalize(v)).pathname);
			console.log(test);
			return test;
		})();
	};
	static exit = (exitCode?: number) => {
		return ts.sys.exit(exitCode);
	};
}
