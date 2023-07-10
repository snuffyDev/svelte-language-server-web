// preshim.ts
import { createSystem } from "@typescript/vfs";
const __dirname = import.meta.url || "";
import _typescript1 from "typescript";
var typescript$1 = _typescript1;
if (!globalThis.typescript$1) globalThis.typescript$1 = typescript$1;
if (!globalThis.typescript$1.sys)
	_typescript1.sys = createSystem(new Map([["/tsconfig.json", "{}"]]));
var glob = { sync: (a, b) => [] };
var fastglob = { sync: (a, b) => [] };
//@ts-ignore
import process from "process";
process.versions = {};
process.versions.node = "v16.16.1";
export {};
