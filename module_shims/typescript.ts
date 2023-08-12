/**
 * @fileoverview
 * This module is a proxy for the TypeScript import, since TS5 uses ESM now.
 * We need to control certain aspects of what can be done, what functionality can be used, etc.
 */
// @ts-ignore
import typescript from "../node_modules/typescript/lib/tsserverlibrary.js";
const { createLanguageService: createLanguageService2 } = typescript;

const sys = typescript.sys;
let ts = {
	...typescript,
	getDefaultLibFilePath() {
		return "/node_modules/typescript/lib/lib.d.ts";
	},
	setSys() {},
	sys, // ...langService,
} as Partial<typeof typescript>;

const proxy = new Proxy(ts, {
	get(target, p, receiver) {
		if (p === "default") return receiver;
		if (!ts[p]) {
			ts[p] = target[p];
		}
		return ts[p] ? ts[p] : target[p];
	},
	set(target, p, value) {
		if (p === "sys") return true;
		return Reflect.set(!ts[p] ? ts : target, p, value);
	},
});

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
