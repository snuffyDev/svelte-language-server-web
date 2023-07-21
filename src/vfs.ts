import ts from "typescript";
const sys = ts.sys;

import json from "./libs.json";
import _path from "./deps/path-deno";

class VFSImpl {
	public static normalize(path: string) {
		return _path.posix.fromFileUrl(
			path.startsWith("file:///") ? path : new URL(_path.posix.toFileUrl(path)),
		);
	}

	static write(s: string) {
		return ts.sys.write(s);
	}
	static readFile(path: string, encoding?: string) {
		return ts.sys.readFile(VFS.normalize(path), encoding);
	}
	static writeFile(path: string, data: string, writeByteOrderMark?: boolean) {
		return ts.sys.writeFile(
			_path.posix.normalize(VFS.normalize(path)),
			data,
			writeByteOrderMark,
		);
	}
	static resolvePath(path: string) {
		return ts.sys.resolvePath(VFS.normalize(path));
	}
	static fileExists(path: string) {
		return ts.sys.fileExists(VFS.normalize(path));
	}
	static directoryExists(path: string) {
		return ts.sys.directoryExists(path);
	}
	static createDirectory(path: string) {
		return ts.sys.createDirectory(path);
	}
	static getExecutingFilePath = () => {
		return ts.sys.getExecutingFilePath();
	};
	static getCurrentDirectory = () => {
		return ts.sys.getCurrentDirectory();
	};
	static getDirectories(path: string) {
		return ts.sys.getDirectories(path);
	}

	static readDirectory(
		path: string,
		extensions?: readonly string[],
		exclude?: readonly string[],
		include?: readonly string[],
		depth?: number,
	) {
		const test = sys
			.readDirectory(path, extensions, exclude, include, depth)
			.map((v) => _path.posix.toFileUrl(VFS.normalize(v)).pathname);
		return test;
	}
	static exit(exitCode?: number) {
		return ts.sys.exit(exitCode);
	}
}

export var VFS = VFSImpl;

const fsMap = new Map(
	Object.entries(json).map(([key, value]) => [
		`/node_modules/typescript/lib/${key}`,
		value,
	]),
);

VFS.writeFile(
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
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true
	}
}
`,
);

// SET SVELTE DEFINITIONS
// @ts-expect-error glob?
const files = import.meta.glob("/node_modules/svelte/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in files) {
	VFS.writeFile(file, files[file]);
}

// SET SVELTE2TSX DEFINITIONS
// @ts-expect-error glob?
const filesS2TSX = import.meta.glob("/node_modules/svelte2tsx/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in filesS2TSX) {
	VFS.writeFile(file, filesS2TSX[file]);
}

// SET PREPROCESS DEFINITIONS
// @ts-expect-error glob?
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

// Just making sure everything's there!
fsMap.forEach((value, key) => {
	VFS.writeFile(key, value);
});

export default sys;
export { sys };
