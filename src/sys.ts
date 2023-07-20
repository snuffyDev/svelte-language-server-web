import { createSystem } from "@typescript/vfs";
import ts from "./../module_shims/typescript";
// const json = import.meta.glob("./libs.json", {
// 	eager: true,
// 	import: "default",
// 	query: "?json",
// });
import json from "./libs.json" assert { type: "json" };
console.log(json);
const fsMap = new Map(
	Object.entries(json).map(([key, value]) => [
		`/node_modules/typescript/lib/${key}`,
		value,
	]),
);
import { VFS } from "./vfs";
console.log(VFS, ts.sys);
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
// (globalThis.localStorage = new MemoryStorage([])), console.log(globalThis);

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
const files = import.meta.glob("/node_modules/svelte/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in files) {
	console.log(file, files[file]);
	VFS.writeFile(file, files[file]);
}
const preprocess = import.meta.glob(
	"/node_modules/svelte-preprocess/dist/**/*.d.ts",
	{
		eager: true,
		as: "raw",
	},
);

const filesS2TSX = import.meta.glob("/node_modules/svelte2tsx/**/*.d.ts", {
	eager: true,
	as: "raw",
});
for (const file in filesS2TSX) {
	console.log(file, filesS2TSX[file]);
	VFS.writeFile(file, filesS2TSX[file]);
}

for (const file in preprocess) {
	VFS.writeFile(file, preprocess[file]);
}

// console.log(fsMap);
fsMap.forEach((value, key) => {
	console.log(key);
	VFS.writeFile(key, value);
});

export default ts.sys;
const sys = ts.sys;
export { sys };
