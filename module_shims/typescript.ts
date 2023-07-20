import * as typescript from "typescript/lib/typescript.js";
const { createLanguageService } = typescript;
import {
	createSystem,
	createVirtualLanguageServiceHost,
} from "@typescript/vfs";

const sys = createSystem(new Map());
const languageHost = createVirtualLanguageServiceHost(
	sys,
	[],
	typescript.getDefaultCompilerOptions(),
	typescript,
);

let ts = {
	...typescript,
	setSys(sys) {
		//@ts-expect-error
		typescript.setSys(sys);
	},
	createLanguageService(_host, reg, mode) {
		var host = _host;

		return typescript.createLanguageService.bind(this)(host, reg, mode);
	},
	sys, // ...langService,
} as Partial<typeof typescript>;

const proxy = new Proxy(ts, {
	get(target, p, receiver) {
		// console.log({ receiver });
		if (p === "default") return receiver;
		if (!ts[p]) {
			ts[p] = target[p];
		}
		return ts[p] ? ts[p] : target[p];
	},
	set(target, p, value, receiver) {
		if (p === "sys") return true;
		return Reflect.set(!ts[p] ? ts : target, p, value);
	},
});

proxy.host = () => createLanguageService(languageHost.languageServiceHost);
export default (() => proxy)();

const { setSys } = proxy;
export { setSys };
