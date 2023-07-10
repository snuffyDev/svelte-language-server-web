//@ts-nocheck
// import "./preshim";
import "./fs";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	createConnection,
} from "vscode-languageserver/browser";

const worker: Worker = _self as any;

const conn = createConnection(
	new BrowserMessageReader(worker),
	new BrowserMessageWriter(worker),
);

import { MemoryStorage } from "./services/storageImpl.js";
import { startServer } from "./server";
import { VFS } from "./vfs";

(globalThis.localStorage = new MemoryStorage([])), console.log(globalThis);

// Create the tsConfig (should be done somewhere else!)
self.typescript$1.sys.writeFile(
	"/tsconfig.json",
	`{
	"compilerOptions": {
		"target": "ES2020",
		"useDefineForClassFields": true,
		"module": "ESNext",
		"lib": ["ES2020", "DOM", "DOM.Iterable"],

		/* Bundler mode */
		"moduleResolution": "Node",
		"allowImportingTsExtensions": true,
		"resolveJsonModule": true,
		"isolatedModules": true,
		"noEmit": true,
		"suppressImplicitAnyIndexErrors": true,
		/* Linting */
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
	// console.log(file, files[file]);
	VFS.writeFile(file, files[file]);
}
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
VFS.writeFile(
	"/svelte.config.js",
	`
import preprocess from 'svelte-preprocess';
export default {
	// Consult https://svelte.dev/docs#compile-time-svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),
  }
`,
);
addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

// Start the server
startServer({ connection: conn });
