//@ts-nocheck
import { workerInit } from "nanothreads";

export class MemoryStorage extends Map<string, string> implements Storage {
	constructor(iterable: any) {
		super(iterable);
	}
	[name: string]: any;
	length: number;
	key(index: number): string | null {
		throw new Error("Method not implemented.");
	}
	// @ts-expect-error Override
	override set(key: string, value: string): null {
		super.set(key, value);
		return null;
	}
	getItem = (...args: Parameters<(typeof localStorage)["getItem"]>) =>
		this.get(...args) ?? null;
	setItem = (...args: Parameters<(typeof localStorage)["setItem"]>) => {
		this.set(...args);
	};
	removeItem = (file: string) => this.delete(file);
}

export type StorageOperation<
	T extends "get" | "clear" | "set" | "delete" | "all",
> = T extends "clear"
	? (method: "clear", params: never, value: never) => void
	: T extends "delete"
	? (method: "delete", params: never, value: never) => void
	: T extends "set"
	? (method: "set", params: string, value: string) => void
	: T extends "get"
	? (method: "get", params: never, value: never) => string | null
	: (
			method: "get" | "set" | "delete" | "clear",
			params: any,
			value: any,
	  ) => any;

const storageInit = async (): StorageOperation<"all"> => {
	const fs = new MemoryStorage([]);

	return (method, params?, value?) => {
		return fs[method](params, value) as never;
	};
};

workerInit(globalThis, storageInit());
