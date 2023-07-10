//@ts-nocheck
import type * as _vfs from "@typescript/vfs";
import ts from "typescript";

const sys = self.typescript$1.sys;
/**
 * A helper class for VFS Path Operations (writing to the TS VFS).
 *
 * Handles normalization from `file:///myFile.ts` -> `/myFile.ts`
 */
export class VFS {
	public static normalize(path: string) {
		return path.replace(/^(file:)?(\/?\/?\/?)/, "/");
	}

	static write = (s: string) => {
		return self.typescript$1.sys.write(s);
	};
	static readFile = (path: string, encoding?: string) => {
		return sys.readFile(VFS.normalize(path), encoding);
	};
	static writeFile = (
		path: string,
		data: string,
		writeByteOrderMark?: boolean,
	) => {
		return sys.writeFile(VFS.normalize(path), data, writeByteOrderMark);
	};
	static resolvePath = (path: string) => {
		return sys.resolvePath(VFS.normalize(path));
	};
	static fileExists = (path: string) => {
		return sys.fileExists(VFS.normalize(path));
	};
	static directoryExists = (path: string) => {
		return sys.directoryExists(path);
	};
	static createDirectory = (path: string) => {
		return sys.createDirectory(path);
	};
	static getExecutingFilePath = () => {
		return sys.getExecutingFilePath();
	};
	static getCurrentDirectory = () => {
		return sys.getCurrentDirectory();
	};
	static getDirectories = (path: string) => {
		return sys.getDirectories(path);
	};

	static readDirectory = (
		path: string,
		extensions?: readonly string[],
		exclude?: readonly string[],
		include?: readonly string[],
		depth?: number,
	) => {
		return sys
			.readDirectory(path ?? "/", extensions, exclude, include, depth)
			.map(VFS.normalize);
	};
	static exit = (exitCode?: number) => {
		return sys.exit(exitCode);
	};
}
