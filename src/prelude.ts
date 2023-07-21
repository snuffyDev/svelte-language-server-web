// preshim.ts - prelude to everything
import _typescript1 from "../module_shims/typescript";

var typescript$1 = _typescript1;
if (!globalThis.typescript$1) globalThis.typescript$1 = typescript$1;

//@ts-ignore
import process from "process";
// @ts-expect-error patching process.versions
process.versions = {};
process.versions.node = "v16.16.1";
export {};
