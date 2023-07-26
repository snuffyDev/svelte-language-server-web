/// <reference types="node" />
/// <reference types="node" />
import { Dirent, Stats } from "fs";
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
declare function readFile(path: string | Buffer | URL, options?: ReadOptions | Encoding): Promise<string | Buffer>;
declare function createReadStream(path: string | Buffer | URL): import("fs").ReadStream;
declare function createWriteStream(path: string | Buffer | URL): import("fs").WriteStream;
declare function exists(path: string | Buffer | URL): Promise<boolean>;
declare function open(path: string | Buffer | URL, flags: string | number, mode?: number): Promise<number>;
declare function symlink(target: string | Buffer | URL, path: string | Buffer | URL): Promise<void>;
declare function closeSync(fd: number): void;
declare function fchmodSync(fd: number, mode: string | number): void;
declare function fchownSync(fd: number, uid: number, gid: number): void;
declare function fsyncSync(fd: number): void;
declare function ftruncateSync(fd: number, len?: number): void;
declare function futimesSync(fd: number, atime: number | Date, mtime: number | Date): void;
declare function readSync(fd: number, buffer: Buffer, offset: number, length: number, position?: number | null): number;
declare function writeFile(path: string | Buffer | URL, data: string | Buffer, options?: WriteOptions): Promise<void>;
declare function existsSync(path: string | Buffer | URL): boolean;
declare function mkdirSync(path: string | Buffer | URL, mode?: number): void;
declare function statSync(path: string | Buffer | URL, options?: StatsOptions): Stats;
declare function readFileSync(path: string | Buffer | URL, options?: Encoding): string | Buffer | undefined;
declare function writeFileSync(path: string | Buffer | URL, data: string | Buffer, options?: WriteOptions): void;
declare function readdirSyncWithFileTypes(path: string | Buffer | URL): Dirent[];
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
declare function accessSync(path: string | Buffer | URL, mode?: number): void;
declare function chmodSync(path: string | Buffer | URL, mode: string | number): void;
declare function chownSync(path: string | Buffer | URL, uid: number, gid: number): void;
declare function linkSync(existingPath: string | Buffer | URL, newPath: string | Buffer | URL): void;
declare function symlinkSync(target: string | Buffer | URL, path: string | Buffer | URL, type?: string): void;
declare function truncateSync(path: string | Buffer | URL, len?: number): void;
declare function unlinkSync(path: string | Buffer | URL): void;
declare function rmdirSync(path: string | Buffer | URL): void;
declare function lstatSync(path: string | Buffer | URL): Stats;
declare function fstatSync(fd: number): Stats;
declare function readlinkSync(path: string | Buffer | URL): string;
declare function watch(filename: string, options?: {
    encoding?: Encoding;
} | Encoding, listener?: (event: string, filename: string) => void): import("fs").FSWatcher;
declare function lstat(path: string | Buffer | URL): Promise<Stats>;
declare function openSync(path: string | Buffer | URL, flags: string | number, mode?: number): number;
declare function readdir(path: string | Buffer | URL): Promise<string[]>;
declare function readdirSync(path: string | Buffer | URL): string[];
declare function realpathSync(path: string | Buffer | URL): string;
declare function stat(path: string | Buffer | URL): Promise<Stats>;
declare const S: unique symbol;
declare const proxy: {
    "___graceful-fs.queue": () => void;
    [S]: () => void;
    readFile: typeof readFile;
    readFileSync: typeof readFileSync;
    existsSync: typeof existsSync;
    lstat: typeof lstat;
    openSync: typeof openSync;
    readdir: typeof readdir;
    readdirSync: typeof readdirSync;
    realpathSync: typeof realpathSync;
    stat: typeof stat;
    statSync: typeof statSync;
    accessSync: typeof accessSync;
    chmodSync: typeof chmodSync;
    chownSync: typeof chownSync;
    linkSync: typeof linkSync;
    symlinkSync: typeof symlinkSync;
    truncateSync: typeof truncateSync;
    unlinkSync: typeof unlinkSync;
    rmdirSync: typeof rmdirSync;
    lstatSync: typeof lstatSync;
    fstatSync: typeof fstatSync;
    readlinkSync: typeof readlinkSync;
    watch: typeof watch;
    writeFile: typeof writeFile;
    mkdirSync: typeof mkdirSync;
    createReadStream: typeof createReadStream;
    createWriteStream: typeof createWriteStream;
    exists: typeof exists;
    open: typeof open;
    symlink: typeof symlink;
    closeSync: typeof closeSync;
    fchmodSync: typeof fchmodSync;
    fchownSync: typeof fchownSync;
    fsyncSync: typeof fsyncSync;
    ftruncateSync: typeof ftruncateSync;
    futimesSync: typeof futimesSync;
    readSync: typeof readSync;
    writeFileSync: typeof writeFileSync;
    readdirSyncWithFileTypes: typeof readdirSyncWithFileTypes;
    realpath: typeof realpathSync;
};
declare const _readFile: typeof readFile, _readFileSync: typeof readFileSync, _existsSync: typeof existsSync, _lstat: typeof lstat, _openSync: typeof openSync, _readdir: typeof readdir, _readdirSync: typeof readdirSync, _realpathSync: typeof realpathSync, _stat: typeof stat, _statSync: typeof statSync, _accessSync: typeof accessSync, _chmodSync: typeof chmodSync, _chownSync: typeof chownSync, _linkSync: typeof linkSync, _symlinkSync: typeof symlinkSync, _truncateSync: typeof truncateSync, _createReadStream: typeof createReadStream, _createWriteStream: typeof createWriteStream, _exists: typeof exists, _open: typeof open, _symlink: typeof symlink, _closeSync: typeof closeSync, _fchmodSync: typeof fchmodSync, _fchownSync: typeof fchownSync, _fsyncSync: typeof fsyncSync, _ftruncateSync: typeof ftruncateSync, _futimesSync: typeof futimesSync, _readSync: typeof readSync, _unlinkSync: typeof unlinkSync, _rmdirSync: typeof rmdirSync, _lstatSync: typeof lstatSync, _fstatSync: typeof fstatSync, _readlinkSync: typeof readlinkSync, _watch: typeof watch, _writeFile: typeof writeFile, _mkdirSync: typeof mkdirSync, _writeFileSync: typeof writeFileSync;
export { _readFile as readFile, _readFileSync as readFileSync, _existsSync as existsSync, _lstat as lstat, _openSync as openSync, _readdir as readdir, _readdirSync as readdirSync, _realpathSync as realpathSync, _stat as stat, _statSync as statSync, _accessSync as accessSync, _chmodSync as chmodSync, _chownSync as chownSync, _linkSync as linkSync, _symlinkSync as symlinkSync, _truncateSync as truncateSync, _createReadStream as createReadStream, _createWriteStream as createWriteStream, _exists as exists, _open as open, _symlink as symlink, _closeSync as closeSync, _fchmodSync as fchmodSync, _fchownSync as fchownSync, _fsyncSync as fsyncSync, _ftruncateSync as ftruncateSync, _futimesSync as futimesSync, _readSync as readSync, _unlinkSync as unlinkSync, _rmdirSync as rmdirSync, _lstatSync as lstatSync, _fstatSync as fstatSync, _readlinkSync as readlinkSync, _watch as watch, _writeFile as writeFile, _mkdirSync as mkdirSync, _writeFileSync as writeFileSync, };
export default proxy;
export declare const customPromisifyArgs: symbol;
declare function promisify(original: any): any;
declare var _TextDecoder: {
    new (label?: string, options?: TextDecoderOptions): TextDecoder;
    prototype: TextDecoder;
};
export { _TextDecoder as TextDecoder, promisify };
