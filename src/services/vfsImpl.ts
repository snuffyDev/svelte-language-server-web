import { workerInit } from "nanothreads";
import * as ts from "typescript";
import { VFS } from "../vfs";
import * as tsvfs from "@typescript/vfs";

const setup = async () => {
	const vfs = await VFS.create_and_fetch_types({}, ts, tsvfs);
	return (files) => {
		return vfs;
	};
};

export const vfs = (await setup())();
