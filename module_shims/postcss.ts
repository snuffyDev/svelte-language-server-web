// Create a shim for PostCSS to use our VFS.
// PostCSS exports a function that takes in plugins for it to use.
// We can use this to create a shim that will intercept the file system calls and use our VFS instead.

import postcss = require("../node_modules/postcss/lib/postcss");
import * as path from "path";
import fs, { existsSync, writeFileSync } from "fs";

const normalize = (path: string) => {
	return path.replace(/\\/g, "/");
};

export default (plugins: any[]) => {
	const processor = postcss(...plugins);

	const origProcess = processor.process;
	processor.process = async function (css: string, options: any = {}) {
		const { from, to } = options;
		if (from) {
			const fromPath = path.posix.normalize(from);
			const toPath = path.posix.normalize(normalize(to));
			if (existsSync(fromPath)) {
				writeFileSync(fromPath, css);
			}
			if (existsSync(toPath)) {
				writeFileSync(toPath, css);
			}
		}
		return origProcess.call(processor, css, options);
	};
	return processor;
};
