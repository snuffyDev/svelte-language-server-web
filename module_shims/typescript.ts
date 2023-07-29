import process from "process";
process.browser = true;
// @ts-ignore
import typescript = require("../node_modules/typescript/lib/typescript.js");
const { createLanguageService: createLanguageService2 } = typescript;
import {
	createSystem,
	createVirtualLanguageServiceHost,
} from "@typescript/vfs";

const sys = createSystem(new Map());
console.log({ typescript, default: typescript });

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
	getDefaultLibFilePath() {
		return "node_modules/typescript/lib/";
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

proxy.host = () => createLanguageService2(languageHost.languageServiceHost);
export default (() => proxy)();

// export all the typescript stuff from the proxy object
const {
	createSourceFile,
	createWatchProgram,
	createEmitAndSemanticDiagnosticsBuilderProgram,
	createAbstractBuilder,

	// export everything else that exists on the proxy object and create a named export for them
} = proxy;
export {
	createSourceFile,
	createWatchProgram,
	createEmitAndSemanticDiagnosticsBuilderProgram,
	createSemanticDiagnosticsBuilderProgram,
	createAbstractBuilder,
};

const {
	sys: _sys,
	// @ts-ignore
	setSys: _setSys,
} = proxy;

export { _sys as sys, _setSys as setSys };

const { ScriptSnapshot, DisplayPartsSymbol } = proxy;
export { ScriptSnapshot, DisplayPartsSymbol };

const { ScriptTarget, ModuleKind, JsxEmit, ScriptKind } = proxy;
export { ScriptTarget, ModuleKind, JsxEmit, ScriptKind };

const { createPreEmitDiagnostics, flattenDiagnosticMessageText } = proxy;
export { createPreEmitDiagnostics, flattenDiagnosticMessageText };

const { createCompilerDiagnostic, createCompilerDiagnosticFromMessageChain } =
	proxy;
export { createCompilerDiagnostic, createCompilerDiagnosticFromMessageChain };

const { DiagnosticCategory, ModuleResolutionKind, NewLineKind } = proxy;
export { DiagnosticCategory, ModuleResolutionKind, NewLineKind };

const { Extension, ExtensionKind, NodeFlags } = proxy;
export { Extension, ExtensionKind, NodeFlags };

const {
	findConfigFile,
	parseConfigFileTextToJson,
	readConfigFile,
	parseJsonConfigFileContent,
} = proxy;
export {
	findConfigFile,
	parseConfigFileTextToJson,
	readConfigFile,
	parseJsonConfigFileContent,
};

const {
	getPreEmitDiagnostics,
	getSemanticDiagnostics,
	getSyntacticDiagnostics,
	getDeclarationDiagnostics,
	getGlobalDiagnostics,
	getConfigFileParsingDiagnostics,
} = proxy;
export {
	getPreEmitDiagnostics,
	getSemanticDiagnostics,
	getSyntacticDiagnostics,
	getDeclarationDiagnostics,
	getGlobalDiagnostics,
	getConfigFileParsingDiagnostics,
};

const {
	createCompilerHost,
	createIncrementalCompilerHost,
	createSourceMapWriter,
	createWatchCompilerHost,
} = proxy;
export {
	createCompilerHost,
	createIncrementalCompilerHost,
	createSourceMapWriter,
	createWatchCompilerHost,
};

const { createIncrementalProgram, createProgram } = proxy;
export { createIncrementalProgram, createProgram };

const {
	getSupportedExtensions,
	resolveModuleName,
	resolveTypeReferenceDirective,
} = proxy;
export {
	getSupportedExtensions,
	resolveModuleName,
	resolveTypeReferenceDirective,
};

const {
	createLanguageService,
	createLanguageServiceSourceFile,
	createLanguageServiceHost,
} = proxy;
export {
	createLanguageService,
	createLanguageServiceSourceFile,
	createLanguageServiceHost,
};

const { createDocumentRegistry } = proxy;
export { createDocumentRegistry };

const { createSemanticDiagnosticsBuilderProgram } = proxy;

const obj = {
	get sys() {
		return _sys;
	},
	set sys(sys) {
		_setSys(sys);
	},
};
