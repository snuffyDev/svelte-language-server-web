//@ts-ignore
import { resolve } from "../src/deps/path-deno";
import { VFS } from "../src/vfs";

interface ReadOptions {
	encoding?: Encoding;
	flag?: string;
}

interface WriteOptions {
	encoding?: Encoding;
	mode?: number;
	flag?: string;
}

interface StatsOptions {
	bigint?: boolean;
}

function readFile(
	path: string | Buffer | URL,
	options: ReadOptions | Encoding = "utf8",
): Promise<string | Buffer> {
	return new Promise((resolve, reject) => {
		const normalizedPath = normalizePath(path.toString());
		const encoding =
			typeof options === "string" ? options : options.encoding || "utf8";

		try {
			const data = VFS.readFile(normalizedPath, encoding);
			resolve(data);
		} catch (error) {
			reject(error);
		}
	});
}
function createReadStream(
	path: string | Buffer | URL,
): import("fs").ReadStream {
	throw new Error("createReadStream is not supported in the VFS");
}

function createWriteStream(
	path: string | Buffer | URL,
): import("fs").WriteStream {
	throw new Error("createWriteStream is not supported in the VFS");
}

function exists(path: string | Buffer | URL): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const normalizedPath = normalizePath(path.toString());

		try {
			const fileExists = VFS.fileExists(normalizedPath);
			resolve(fileExists);
		} catch (error) {
			reject(error);
		}
	});
}

function open(
	path: string | Buffer | URL,
	flags: string | number,
	mode?: number,
): Promise<number> {
	return new Promise((resolve, reject) => {
		reject(new Error("open is not supported in the VFS"));
	});
}

function symlink(
	target: string | Buffer | URL,
	path: string | Buffer | URL,
): Promise<void> {
	return new Promise((resolve, reject) => {
		reject(new Error("symlink is not supported in the VFS"));
	});
}

function closeSync(fd: number): void {
	throw new Error("closeSync is not supported in the VFS");
}

function fchmodSync(fd: number, mode: string | number): void {
	throw new Error("fchmodSync is not supported in the VFS");
}

function fchownSync(fd: number, uid: number, gid: number): void {
	throw new Error("fchownSync is not supported in the VFS");
}

function fsyncSync(fd: number): void {
	throw new Error("fsyncSync is not supported in the VFS");
}

function ftruncateSync(fd: number, len?: number): void {
	throw new Error("ftruncateSync is not supported in the VFS");
}

function futimesSync(
	fd: number,
	atime: number | Date,
	mtime: number | Date,
): void {
	throw new Error("futimesSync is not supported in the VFS");
}

function readSync(
	fd: number,
	buffer: Buffer,
	offset: number,
	length: number,
	position?: number | null,
): number {
	throw new Error("readSync is not supported in the VFS");
}

function writeFile(
	path: string | Buffer | URL,
	data: string | Buffer,
	options: WriteOptions = {},
): Promise<void> {
	return new Promise((resolve, reject) => {
		const normalizedPath = normalizePath(path.toString());
		const encoding = options.encoding || "utf8";
		const writeByteOrderMark = options.flag === "w" && options.mode === 0xfeff;

		try {
			VFS.writeFile(
				normalizedPath,
				data.toString(encoding),
				writeByteOrderMark,
			);
			resolve();
		} catch (error) {
			reject(error);
		}
	});
}

function existsSync(path: string | Buffer | URL): boolean {
	const normalizedPath = normalizePath(path.toString());
	return VFS.fileExists(normalizedPath);
}

function mkdirSync(path: string | Buffer | URL, mode?: number): void {
	const normalizedPath = normalizePath(path.toString());
	VFS.createDirectory(normalizedPath);
}

function statSync(
	path: string | Buffer | URL,
	options: StatsOptions = {},
): Stats {
	const normalizedPath = normalizePath(path.toString());
	const exists = VFS.fileExists(normalizedPath);

	return {
		isFile: () => exists,
		isDirectory: () => !exists,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isSymbolicLink: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		dev: 0,
		ino: 0,
		mode: 0,
		nlink: 0,
		uid: 0,
		gid: 0,
		rdev: 0,
		size: 0,
		blksize: 0,
		blocks: 0,
		atimeMs: 0,
		mtimeMs: 0,
		ctimeMs: 0,
		birthtimeMs: 0,
		atime: new Date(),
		mtime: new Date(),
		ctime: new Date(),
		birthtime: new Date(),
		...(options.bigint && {
			atimeNs: BigInt(0),
			mtimeNs: BigInt(0),
			ctimeNs: BigInt(0),
			birthtimeNs: BigInt(0),
		}),
	};
}

function readFileSync(
	path: string | Buffer | URL,
	options: Encoding = "utf8",
): string | Buffer | undefined {
	const normalizedPath = normalizePath(path.toString());
	const encoding = typeof options === "string" ? options : options || "utf8";

	return VFS.readFile(normalizedPath, encoding);
}

function writeFileSync(
	path: string | Buffer | URL,
	data: string | Buffer,
	options: WriteOptions = {},
): void {
	const normalizedPath = normalizePath(path.toString());
	const encoding = options.encoding || "utf8";
	const writeByteOrderMark = options.flag === "w" && options.mode === 0xfeff;

	VFS.writeFile(normalizedPath, data.toString(encoding), writeByteOrderMark);
}

function readdirSyncWithFileTypes(path: string | Buffer | URL): Dirent[] {
	const normalizedPath = normalizePath(path.toString());
	const files = VFS.readDirectory(normalizedPath);

	return files.map((file) => ({
		name: file,
		isFile: () => VFS.fileExists(file),
		isDirectory: () => !VFS.fileExists(file),
	}));
}

import { Dirent, Stats } from "fs";

type Encoding = BufferEncoding | null;

interface ReadOptions {
	encoding?: Encoding;
	flag?: string;
}

interface WriteOptions {
	encoding?: Encoding;
	mode?: number;
	flag?: string;
}

interface StatsOptions {
	bigint?: boolean;
}

function normalizePath(path: string): string {
	return VFS.normalize(path);
}

function accessSync(path: string | Buffer | URL, mode?: number): void {
	const normalizedPath = normalizePath(path.toString());
	if (!VFS.fileExists(normalizedPath)) {
		const err = new Error(`File does not exist: ${normalizedPath}`);
		console.error(err);
		throw err;
	}
	// Mode checking not supported in the vfs, but we can add checks for different modes if needed.
}

function chmodSync(path: string | Buffer | URL, mode: string | number): void {
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
}

function chownSync(
	path: string | Buffer | URL,
	uid: number,
	gid: number,
): void {
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
}

function linkSync(
	existingPath: string | Buffer | URL,
	newPath: string | Buffer | URL,
): void {
	const normalizedExistingPath = normalizePath(existingPath.toString());
	const normalizedNewPath = normalizePath(newPath.toString());
	// Not supported in the vfs, but can be implemented if needed.
}

function symlinkSync(
	target: string | Buffer | URL,
	path: string | Buffer | URL,
	type?: string,
): void {
	const normalizedTarget = normalizePath(target.toString());
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
}

function truncateSync(path: string | Buffer | URL, len?: number): void {
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
}

function unlinkSync(path: string | Buffer | URL): void {
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
}

function rmdirSync(path: string | Buffer | URL): void {
	const normalizedPath = normalizePath(path.toString());

	// Not supported in the vfs, but can be implemented if needed.
}

function lstatSync(path: string | Buffer | URL): Stats {
	const normalizedPath = normalizePath(path.toString());
	const exists = VFS.fileExists(normalizedPath);

	return {
		isFile: () => exists,
		isDirectory: () => !exists,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isSymbolicLink: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		dev: 0,
		ino: 0,
		mode: 0,
		nlink: 0,
		uid: 0,
		gid: 0,
		rdev: 0,
		size: 0,
		blksize: 0,
		blocks: 0,
		atimeMs: 0,
		mtimeMs: 0,
		ctimeMs: 0,
		birthtimeMs: 0,
		atime: new Date(),
		mtime: new Date(),
		ctime: new Date(),
		birthtime: new Date(),
	};
}

function fstatSync(fd: number): Stats {
	// Not supported in the vfs, but can be implemented if needed.
	throw new Error("fstatSync is not supported in the vfs");
}

function readlinkSync(path: string | Buffer | URL): string {
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
	throw new Error("readlinkSync is not supported in the vfs");
}

function watch(
	filename: string,
	options?: { encoding?: Encoding } | Encoding,
	listener?: (event: string, filename: string) => void,
): import("fs").FSWatcher {
	const normalizedPath = normalizePath(filename);

	// Not supported in the vfs, but can be implemented if needed.
	throw new Error("watch is not supported in the vfs");
}

function lstat(path: string | Buffer | URL): Promise<Stats> {
	return new Promise((resolve, reject) => {
		const normalizedPath = normalizePath(path.toString());

		try {
			const stats = lstatSync(normalizedPath);
			resolve(stats);
		} catch (error) {
			reject(error);
		}
	});
}
function openSync(
	path: string | Buffer | URL,
	flags: string | number,
	mode?: number,
): number {
	// Not supported in the vfs, but can be implemented if needed.
	throw new Error("openSync is not supported in the vfs");
}

function readdir(path: string | Buffer | URL): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const normalizedPath = normalizePath(path.toString());

		try {
			const files = VFS.readDirectory(normalizedPath);
			resolve(files);
		} catch (error) {
			reject(error);
		}
	});
}

function readdirSync(path: string | Buffer | URL): string[] {
	const normalizedPath = normalizePath(path.toString());
	return VFS.readDirectory(normalizedPath);
}

function realpathSync(path: string | Buffer | URL): string {
	const normalizedPath = normalizePath(path.toString());
	// Not supported in the vfs, but can be implemented if needed.
	// throw new Error('realpathSync is not supported in the vfs');
}

function stat(path: string | Buffer | URL): Promise<Stats> {
	return new Promise((resolve, reject) => {
		const normalizedPath = normalizePath(path.toString());

		try {
			const stats = lstat(normalizedPath);
			resolve(stats);
		} catch (error) {
			reject(error);
		}
	});
}
const S = Symbol.for("graceful-fs.queue");

const rw = {
	"___graceful-fs.queue": () => {},
	[S]: () => {},
	readFile,
	readFileSync,
	existsSync,
	lstat,
	openSync,
	readdir,
	readdirSync,
	realpathSync,
	stat,
	statSync,
	accessSync,
	chmodSync,
	chownSync,
	linkSync,
	symlinkSync,
	truncateSync,
	unlinkSync,
	rmdirSync,
	lstatSync,
	fstatSync,
	readlinkSync,
	watch,
	writeFile,
	mkdirSync,
	createReadStream,
	createWriteStream,
	exists,
	open,
	symlink,
	closeSync,
	fchmodSync,
	fchownSync,
	fsyncSync,
	ftruncateSync,
	futimesSync,
	readSync,
	writeFileSync,
	readdirSyncWithFileTypes,
	realpath: realpathSync,
};

rw.realpath.native = (path, options, callback) => {
	if (!callback) options(null, resolve(path));
	else if (callback) callback(null, resolve(path));
};
rw.realpathSync.native = (path, options) => {
	return resolve(path);
};

// export * from "../fsImpl";

const proxy = new Proxy(
	{ [S]: () => {}, ...rw },
	{
		get(target, prop, _receiver) {
			console.warn(`FS GET`, { target, prop, _receiver });
			if (!target[prop]) target[prop] = {};

			return Reflect.get(target, prop);
		},
		preventExtensions(target) {
			return false;
		},

		set(target, p, newValue, receiver) {
			console.warn(`FS SET`, { target, p, newValue, receiver });
			return Reflect.set(target, p, newValue, receiver);
		},
	},
);
const {
	readFile: _readFile,
	readFileSync: _readFileSync,
	existsSync: _existsSync,
	lstat: _lstat,
	openSync: _openSync,
	readdir: _readdir,
	readdirSync: _readdirSync,
	realpathSync: _realpathSync,
	stat: _stat,
	statSync: _statSync,
	accessSync: _accessSync,
	chmodSync: _chmodSync,
	chownSync: _chownSync,
	linkSync: _linkSync,
	symlinkSync: _symlinkSync,
	truncateSync: _truncateSync,
	createReadStream: _createReadStream,
	createWriteStream: _createWriteStream,
	exists: _exists,
	open: _open,
	symlink: _symlink,
	closeSync: _closeSync,
	fchmodSync: _fchmodSync,
	fchownSync: _fchownSync,
	fsyncSync: _fsyncSync,
	ftruncateSync: _ftruncateSync,
	futimesSync: _futimesSync,
	readSync: _readSync,
	unlinkSync: _unlinkSync,
	rmdirSync: _rmdirSync,
	lstatSync: _lstatSync,
	fstatSync: _fstatSync,
	readlinkSync: _readlinkSync,
	watch: _watch,
	writeFile: _writeFile,
	mkdirSync: _mkdirSync,
	writeFileSync: _writeFileSync,
	readdirSyncWithFileTypes: _readdirSyncWithFileTypes,
} = proxy;

export {
	_readFile as readFile,
	_readFileSync as readFileSync,
	_existsSync as existsSync,
	_lstat as lstat,
	_openSync as openSync,
	_readdir as readdir,
	_readdirSync as readdirSync,
	_realpathSync as realpathSync,
	_stat as stat,
	_statSync as statSync,
	_accessSync as accessSync,
	_chmodSync as chmodSync,
	_chownSync as chownSync,
	_linkSync as linkSync,
	_symlinkSync as symlinkSync,
	_truncateSync as truncateSync,
	_createReadStream as createReadStream,
	_createWriteStream as createWriteStream,
	_exists as exists,
	_open as open,
	_symlink as symlink,
	_closeSync as closeSync,
	_fchmodSync as fchmodSync,
	_fchownSync as fchownSync,
	_fsyncSync as fsyncSync,
	_ftruncateSync as ftruncateSync,
	_futimesSync as futimesSync,
	_readSync as readSync,
	_unlinkSync as unlinkSync,
	_rmdirSync as rmdirSync,
	_lstatSync as lstatSync,
	_fstatSync as fstatSync,
	_readlinkSync as readlinkSync,
	_watch as watch,
	_writeFile as writeFile,
	_mkdirSync as mkdirSync,
	_writeFileSync as writeFileSync,
};
export default proxy;
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
