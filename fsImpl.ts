import {
	readFileSync as _readFileSync,
	existsSync as _existsSync,
	writeFileSync as _writeFileSync,
	readFile as _readFile,
	openSync as _openSync,
	readdir as _readdir,
	Dirent,
	stat as _stat,
	realpathSync as _realpathSync,
} from "node:fs";
import { Buffer as _Buffer } from "buffer";
// In addition to being accessible through util.promisify.custom,
// this symbol is registered globally and can be accessed in any environment as
// Symbol.for('nodejs.util.promisify.custom').
const kCustomPromisifiedSymbol = Symbol.for("nodejs.util.promisify.custom");
// This is an internal Node symbol used by functions returning multiple
// arguments, e.g. ['bytesRead', 'buffer'] for fs.read().
const kCustomPromisifyArgsSymbol = Symbol.for(
	"nodejs.util.promisify.customArgs",
);

export const customPromisifyArgs = kCustomPromisifyArgsSymbol;
function promisify(original) {
	if (typeof original !== "function") return () => Promise.resolve(original);
	if (original[kCustomPromisifiedSymbol]) {
		const fn = original[kCustomPromisifiedSymbol];

		return Object.defineProperty(fn, kCustomPromisifiedSymbol, {
			value: fn,
			enumerable: false,
			writable: false,
			configurable: true,
		});
	}

	// Names to create an object from in case the callback receives multiple
	// arguments, e.g. ['bytesRead', 'buffer'] for fs.read.
	const argumentNames = original[kCustomPromisifyArgsSymbol];
	function fn(...args) {
		return new Promise((resolve, reject) => {
			args.push((err, ...values) => {
				if (err) {
					return reject(err);
				}
				if (argumentNames !== undefined && values.length > 1) {
					const obj = {};
					for (let i = 0; i < argumentNames.length; i++) {
						obj[argumentNames[i]] = values[i];
					}
					resolve(obj);
				} else {
					resolve(values[0]);
				}
			});
			Reflect.apply(original, this, args);
		});
	}

	Object.setPrototypeOf(fn, Object.getPrototypeOf(original));

	Object.defineProperty(fn, kCustomPromisifiedSymbol, {
		value: fn,
		enumerable: false,
		writable: false,
		configurable: true,
	});
	return Object.defineProperties(
		fn,
		Object.getOwnPropertyDescriptors(original),
	);
}
var _TextDecoder = TextDecoder;
export { _TextDecoder as TextDecoder, promisify };

// import { SourceMapConsumer } from "source-map/source-map";
// import {workspace,Uri} from "vscode"

let packagemock = "typescriptServerPlugins-disabled";

let readFileSync: typeof _readFileSync = (path, options) => {
	// console.log("reading ", path);
	if (path === "aaa") return _Buffer.from(packagemock) as any;
};

let realpathSync: typeof _realpathSync = (path, options) => {
	// console.log("reading ", path);
	if (path === "aaa") return _Buffer.from(packagemock) as any;
};
realpathSync.native = false;

let writeFileSync: typeof _writeFileSync = (path, options) => {
	// console.log("writing ", path);

	if ((path as ReturnType<typeof _stat>) === "aaa")
		return _Buffer.from(packagemock) as any;
};

let openSync: typeof _openSync = (path, cb) => {
	// workspace.fs.readFile(Uri.file(path)).then(
	//     content=>cb(null,_Buffer.from(content)),
	//     err=>cb(err,null),
	// )
};

let readFile: typeof _readFile = (path, cb) => {
	cb("unimplemented", null);
	// workspace.fs.readFile(Uri.file(path)).then(
	//     content=>cb(null,_Buffer.from(content)),
	//     err=>cb(err,null),
	// )
};

let readdir: typeof _readdir = (...args) => {
	return [];
};

let readdirSync: typeof _readdir = (...args) => {
	return [];
};

readdir.__promisify__ = promisify(readdir);
readdirSync.__promisify__ = promisify(readdirSync);

readFile.__promisify__ = promisify(readFile);

// SourceMapConsumer.initialize({
// 	"lib/mappings.wasm": "https://unpkg.com/source-map@0.7.3/lib/mappings.wasm",
// });

let existsSync: typeof _existsSync = (...args) => {
	return false;
};
let stat: typeof _stat = (...args) => {
	return () => ({});
};
let statSync: typeof _stat = (...args) => {
	return () => ({});
};

stat.__promisify__ = promisify(stat);
let mod = {
	existsSync,
	stat,
	readdir,
	readFile,
	readdirSync,
	readFileSync,
	realpathSync,
	openSync,
	lstat: stat,
	statSync,
};

for (const key in mod) {
	Object.defineProperty(mod, key, {
		writable: true,
		configurable: true,
		enumerable: true,
		value: mod[key],
	});
}

export default mod;
