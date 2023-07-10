import "./fs";
import ts from "typescript";
import {
	ApplyWorkspaceEditParams,
	ApplyWorkspaceEditRequest,
	CodeActionKind,
	DocumentUri,
	Connection,
	MessageType,
	RenameFile,
	RequestType,
	ShowMessageNotification,
	TextDocumentIdentifier,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	WorkspaceEdit,
	SemanticTokensRequest,
	SemanticTokensRangeRequest,
	DidChangeWatchedFilesParams,
	LinkedEditingRangeRequest,
	CallHierarchyPrepareRequest,
	CallHierarchyIncomingCallsRequest,
	CallHierarchyOutgoingCallsRequest,
	InlayHintRequest,
	SemanticTokensRefreshRequest,
	InlayHintRefreshRequest,
	DidChangeWatchedFilesNotification,
} from "vscode-languageserver/browser";
import {
	BrowserMessageReader as IPCMessageReader,
	BrowserMessageWriter as IPCMessageWriter,
	createConnection,
} from "vscode-languageserver/browser";

import { DiagnosticsManager } from "svelte-language-server/dist/src/lib/DiagnosticsManager";
import {
	Document,
	DocumentManager,
} from "svelte-language-server/dist/src/lib/documents";

import { getSemanticTokenLegends } from "svelte-language-server/dist/src/lib/semanticToken/semanticTokenLegend";
import { Logger } from "svelte-language-server/dist/src/logger";
import { LSConfigManager } from "svelte-language-server/dist/src/ls-config";
import {
	AppCompletionItem,
	CSSPlugin,
	HTMLPlugin,
	PluginHost,
	SveltePlugin,
	TypeScriptPlugin,
	OnWatchFileChangesPara,
	LSAndTSDocResolver,
} from "svelte-language-server/dist/src/plugins";
import {
	debounceThrottle,
	isNotNullOrUndefined,
	normalizeUri,
	urlToPath,
} from "svelte-language-server/dist/src/utils";
import { FallbackWatcher } from "svelte-language-server/dist/src/lib/FallbackWatcher";
import { setIsTrusted } from "svelte-language-server/dist/src/importPackage";
import { configLoader } from "svelte-language-server/dist/src/lib/documents/configLoader";
import { SORT_IMPORT_CODE_ACTION_KIND } from "svelte-language-server/dist/src/plugins/typescript/features/CodeActionsProvider";
import { createLanguageServices } from "svelte-language-server/dist/src/plugins/css/service";
import { type FileSystemProvider as FSProvider } from "svelte-language-server/dist/src/plugins/css/FileSystemProvider";
import { FileStat, FileType } from "vscode-css-languageservice";
import { VFS } from "./vfs";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

import { languages } from "prismjs/components";
marked.use({
	extensions: markedHighlight({
		highlight: (input) => (
			console.log(input), hljs.highlight(input, { language: "svelte" }).value
		),
	}).extensions,
	gfm: true,
	breaks: true,
});
const ctime = Date.now();

class FileSystemProvider implements FSProvider {
	stat: (uri: string) => Promise<FileStat>;
	unknownStat() {
		return {
			type: FileType.Unknown,
			ctime: -1,
			mtime: -1,
			size: -1,
		};
	}
	getFileType(stat: FileStat) {
		return !stat
			? FileType.File
			: stat
			? FileType.Directory
			: stat?.isSymbolicLink?.()
			? FileType.SymbolicLink
			: FileType.Unknown;
	}
	constructor() {
		this.stat = async (uri: string): Promise<FileStat> => {
			let type: FileType;
			if (uri.slice(uri.lastIndexOf("."), -1) !== "") {
				type = FileType.File;
			} else {
				type = FileType.Directory;
			}
			return { mtime: performance.now(), ctime, type, size: 10234 };
		};
	}

	async readDirectory(uri: string): Promise<[string, FileType][]> {
		return _self.typescript$1.sys
			.readDirectory(uri)
			.map((s) => [s, FileType.File]);
	}
}
namespace TagCloseRequest {
	export const type: RequestType<
		TextDocumentPositionParams,
		string | null,
		any
	> = new RequestType("html/tag");
}

export interface LSOptions {
	/**
	 * If you have a connection already that the ls should use, pass it in.
	 * Else the connection will be created from `process`.
	 */
	connection?: Connection;
	/**
	 * If you want only errors getting logged.
	 * Defaults to false.
	 */
	logErrorsOnly?: boolean;
}

import * as ppts from "svelte-preprocess/dist/processors/typescript.js";
const compilerOptions = {
	...ts.getDefaultCompilerOptions(),
	strict: true,
	lib: ["DOM", "DOM.iterable", "ESNext", "ES2020"],
	esModuleInterop: true,
	module: ts.ModuleKind.ESNext,
	suppressOutputPathCheck: true,
	skipLibCheck: true,
	skipDefaultLibCheck: true,
	moduleResolution: undefined,
	useCaseSensitiveFileNames: true,
	allowJs: true,
};
// console.log(compilerOptions);
// const conf = {
// 	preprocess: [
// 		ppts.default({
// 			tsconfigFile: "./tsconfig.json",
// 			compilerOptions,
// 			tsconfigDirectory: "/",
// 		}),
// 	],
// 	isFallbackConfig: false,
// 	compilerOptions,
// };

// configLoader.getConfig = (x) => conf;
// configLoader.awaitConfig = () => Promise.resolve(conf);
// configLoader.loadConfigs = () => Promise.resolve();

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSOptions) {
	let connection = options?.connection;
	if (!connection) {
		if (process.argv.includes("--stdio")) {
			console.log = (...args: any[]) => {
				console.warn(...args);
			};
			connection = createConnection(
				{ window } as never,
				console.log as never,
			) as never;
		} else {
			connection = createConnection(
				new IPCMessageReader(process),
				new IPCMessageWriter(process),
			);
		}
	}

	if (options?.logErrorsOnly !== undefined) {
		Logger.setLogErrorsOnly(options.logErrorsOnly);
	}

	const docManager = new DocumentManager(
		(textDocument) => new Document(textDocument.uri, textDocument.text),
	);
	const configManager = new LSConfigManager();
	const pluginHost = new PluginHost(docManager);
	let sveltePlugin: SveltePlugin = undefined as any;
	let watcher: FallbackWatcher | undefined;

	connection.onInitialize((evt) => {
		const workspaceUris = evt.workspaceFolders?.map((folder) =>
			folder.uri.toString(),
		) ?? [evt.rootUri ?? ""];
		Logger.log("Initialize language server at ", workspaceUris.join(", "));
		if (workspaceUris.length === 0) {
			Logger.error("No workspace path set");
		}

		if (!evt.capabilities.workspace?.didChangeWatchedFiles) {
			const workspacePaths = workspaceUris
				.map(urlToPath)
				.filter(isNotNullOrUndefined);
			// watcher = new FallbackWatcher("**/*.{ts,js}", workspacePaths);
			console.log(watcher);
			// watcher.onDidChangeWatchedFiles(onDidChangeWatchedFiles);
		}

		const isTrusted: boolean = evt.initializationOptions?.isTrusted ?? true;
		configLoader.setDisabled(!isTrusted);
		setIsTrusted(isTrusted);
		configManager.updateIsTrusted(isTrusted);
		if (!isTrusted) {
			Logger.log(
				"Workspace is not trusted, running with reduced capabilities.",
			);
		}

		Logger.setDebug(
			(evt.initializationOptions?.configuration?.svelte ||
				evt.initializationOptions?.config)?.["language-server"]?.debug,
		);
		// Backwards-compatible way of setting initialization options (first `||` is the old style)
		configManager.update(
			evt.initializationOptions?.configuration?.svelte?.plugin ||
				evt.initializationOptions?.config ||
				{},
		);
		configManager.updateTsJsUserPreferences(
			evt.initializationOptions?.configuration ||
				evt.initializationOptions?.typescriptConfig ||
				{},
		);
		configManager.updateTsJsFormateConfig(
			evt.initializationOptions?.configuration ||
				evt.initializationOptions?.typescriptConfig ||
				{},
		);
		configManager.updateEmmetConfig(
			evt.initializationOptions?.configuration?.emmet ||
				evt.initializationOptions?.emmetConfig ||
				{},
		);
		configManager.updatePrettierConfig(
			evt.initializationOptions?.configuration?.prettier ||
				evt.initializationOptions?.prettierConfig ||
				{},
		);
		// no old style as these were added later
		configManager.updateCssConfig(
			evt.initializationOptions?.configuration?.css,
		);
		configManager.updateScssConfig(
			evt.initializationOptions?.configuration?.scss,
		);
		configManager.updateLessConfig(
			evt.initializationOptions?.configuration?.less,
		);
		configManager.updateHTMLConfig(
			evt.initializationOptions?.configuration?.html,
		);
		configManager.updateClientCapabilities(evt.capabilities);

		pluginHost.initialize({
			filterIncompleteCompletions:
				!evt.initializationOptions?.dontFilterIncompleteCompletions,
			definitionLinkSupport:
				!!evt.capabilities.textDocument?.definition?.linkSupport,
		});
		// Order of plugin registration matters for FirstNonNull, which affects for example hover info
		pluginHost.register((sveltePlugin = new SveltePlugin(configManager)));
		pluginHost.register(new HTMLPlugin(docManager, configManager));

		const cssLanguageServices = createLanguageServices({
			clientCapabilities: evt.capabilities,
			fileSystemProvider: new FileSystemProvider(),
		});
		const workspaceFolders = evt.workspaceFolders ?? [
			{ name: "", uri: evt.rootUri ?? "file:///" },
		];

		pluginHost.register(
			new CSSPlugin(
				docManager,
				configManager,
				workspaceFolders,
				cssLanguageServices,
			),
		);
		const normalizedWorkspaceUris = workspaceUris.map(normalizeUri);
		pluginHost.register(
			new TypeScriptPlugin(
				configManager,
				new LSAndTSDocResolver(
					docManager,
					normalizedWorkspaceUris,
					configManager,
					{
						tsSystem: self.typescript$1.sys,
						notifyExceedSizeLimit: notifyTsServiceExceedSizeLimit,
						onProjectReloaded: refreshCrossFilesSemanticFeatures,
					},
				),
				normalizedWorkspaceUris,
			),
		);

		const clientSupportApplyEditCommand =
			!!evt.capabilities.workspace?.applyEdit;
		const clientCodeActionCapabilities =
			evt.capabilities.textDocument?.codeAction;
		const clientSupportedCodeActionKinds =
			clientCodeActionCapabilities?.codeActionLiteralSupport?.codeActionKind
				.valueSet;

		return {
			capabilities: {
				foldingRangeProvider: true,
				documentOnTypeFormattingProvider: true,
				textDocumentSync: {
					openClose: true,
					change: TextDocumentSyncKind.Incremental,
					save: {
						includeText: true,
					},
				},
				// diagnosticProvider: {},
				workspace: {
					fileOperations: {
						didCreate: true,
						didDelete: true,
						didRename: true,
						willCreate: true,
						willDelete: true,
						willRename: true,
					},
				},
				hoverProvider: true,
				completionProvider: {
					resolveProvider: true,
					triggerCharacters: [
						".",
						'"',
						"'",
						"`",
						"/",
						"@",
						"<",

						// Emmet
						">",
						"*",
						"#",
						"$",
						"+",
						"^",
						"(",
						"[",
						"@",
						"-",
						// No whitespace because
						// it makes for weird/too many completions
						// of other completion providers

						// Svelte
						":",
						"|",
					],
					completionItem: {
						labelDetailsSupport: true,
					},
				},
				documentFormattingProvider: true,
				colorProvider: true,
				documentSymbolProvider: true,
				definitionProvider: true,
				codeActionProvider:
					clientCodeActionCapabilities?.codeActionLiteralSupport
						? {
								codeActionKinds: [
									CodeActionKind.QuickFix,
									CodeActionKind.SourceOrganizeImports,
									SORT_IMPORT_CODE_ACTION_KIND,
									...(clientSupportApplyEditCommand
										? [CodeActionKind.Refactor]
										: []),
								].filter(
									clientSupportedCodeActionKinds &&
										evt.initializationOptions?.shouldFilterCodeActionKind
										? (kind) => clientSupportedCodeActionKinds.includes(kind)
										: () => true,
								),
								resolveProvider: true,
						  }
						: true,
				executeCommandProvider: clientSupportApplyEditCommand
					? {
							commands: [
								"function_scope_0",
								"function_scope_1",
								"function_scope_2",
								"function_scope_3",
								"constant_scope_0",
								"constant_scope_1",
								"constant_scope_2",
								"constant_scope_3",
								"extract_to_svelte_component",
								"Infer function return type",
							],
					  }
					: undefined,
				renameProvider: evt.capabilities.textDocument?.rename?.prepareSupport
					? { prepareProvider: true }
					: true,
				referencesProvider: true,
				selectionRangeProvider: true,
				signatureHelpProvider: {
					triggerCharacters: ["(", ",", "<"],
					retriggerCharacters: [")"],
				},
				semanticTokensProvider: {
					legend: getSemanticTokenLegends(),
					range: true,
					full: true,
				},
				linkedEditingRangeProvider: true,
				implementationProvider: true,
				typeDefinitionProvider: true,
				inlayHintProvider: true,
				callHierarchyProvider: true,
			},
		};
	});

	connection.onInitialized(() => {
		// if (
		// 	!watcher &&
		// 	configManager.getClientCapabilities()?.workspace?.didChangeWatchedFiles
		// 		?.dynamicRegistration
		// ) {
		// 	connection?.client.register(DidChangeWatchedFilesNotification.type, {
		// 		watchers: [
		// 			{
		// 				globPattern: "**/*.{ts,js,mts,mjs,cjs,cts,json}",
		// 			},
		// 		],
		// 	});
		// }
	});

	function notifyTsServiceExceedSizeLimit() {
		connection?.sendNotification(ShowMessageNotification.type, {
			message:
				"Svelte language server detected a large amount of JS/Svelte files. " +
				"To enable project-wide JavaScript/TypeScript language features for Svelte files, " +
				"exclude large folders in the tsconfig.json or jsconfig.json with source files that you do not work on.",
			type: MessageType.Warning,
		});
	}

	connection.onExit(() => {
		watcher?.dispose();
	});

	connection.onRenameRequest((req) =>
		pluginHost.rename(req.textDocument, req.position, req.newName),
	);
	connection.onPrepareRename((req) =>
		pluginHost.prepareRename(req.textDocument, req.position),
	);

	connection.onDidChangeConfiguration(({ settings }) => {
		configManager.update(settings.svelte?.plugin);
		configManager.updateTsJsUserPreferences(settings);
		configManager.updateTsJsFormateConfig(settings);
		configManager.updateEmmetConfig(settings.emmet);
		configManager.updatePrettierConfig(settings.prettier);
		configManager.updateCssConfig(settings.css);
		configManager.updateScssConfig(settings.scss);
		configManager.updateLessConfig(settings.less);
		configManager.updateHTMLConfig(settings.html);
		Logger.setDebug(settings.svelte?.["language-server"]?.debug);
	});

	connection.onDidOpenTextDocument((evt) => {
		const document = docManager.openDocument(evt.textDocument);
		docManager.markAsOpenedInClient(evt.textDocument.uri);
		diagnosticsManager.scheduleUpdate(document);
		// console.log;
		VFS.writeFile(evt.textDocument.uri, evt.textDocument.text);
	});

	connection.onDidCloseTextDocument((evt) =>
		docManager.closeDocument(evt.textDocument.uri),
	);
	connection.onDidChangeTextDocument((evt) => {
		docManager.updateDocument(evt.textDocument, evt.contentChanges);
		VFS.writeFile(
			evt.textDocument.uri,
			evt.contentChanges.reduce((acc, curr) => (acc += curr.text), ""),
		);
		pluginHost.didUpdateDocument();
	});
	connection.onHover(async (evt) => {
		const result = await pluginHost.doHover(evt.textDocument, evt.position);
		// console.log(result);
		if (Array.isArray(result.contents)) {
			result.contents = result.contents.map((v) => {
				return typeof v === "string"
					? marked.parse(v, { gfm: true, breaks: true })
					: {
							value: marked.parse(v.value, { breaks: true, gfm: true }),
							language: v.language,
					  };
			});
		} else if (typeof result.contents === "string") {
			result.contents = marked.parse(result.contents, { gfm: true });
		} else {
			result.contents = marked.parse(result.contents.value, { gfm: true });
		}
		return result;
	});
	connection.onCompletion((evt, cancellationToken) => {
		console.log(evt, cancellationToken);

		return pluginHost.getCompletions(
			evt.textDocument,
			evt.position,
			evt.context,
			cancellationToken,
		);
	});
	connection.onDocumentFormatting((evt) =>
		pluginHost.formatDocument(evt.textDocument, evt.options),
	);
	connection.onRequest(TagCloseRequest.type, (evt) =>
		pluginHost.doTagComplete(evt.textDocument, evt.position),
	);
	connection.onDocumentColor((evt) =>
		pluginHost.getDocumentColors(evt.textDocument),
	);
	connection.onColorPresentation((evt) =>
		pluginHost.getColorPresentations(evt.textDocument, evt.range, evt.color),
	);
	connection.onDocumentSymbol((evt, cancellationToken) =>
		pluginHost.getDocumentSymbols(evt.textDocument, cancellationToken),
	);
	connection.onDefinition((evt) =>
		pluginHost.getDefinitions(evt.textDocument, evt.position),
	);
	connection.onReferences((evt) =>
		pluginHost.findReferences(evt.textDocument, evt.position, evt.context),
	);

	connection.onCodeAction((evt, cancellationToken) =>
		pluginHost.getCodeActions(
			evt.textDocument,
			evt.range,
			evt.context,
			cancellationToken,
		),
	);
	connection.onExecuteCommand(async (evt) => {
		const result = await pluginHost.executeCommand(
			{ uri: evt.arguments?.[0] },
			evt.command,
			evt.arguments,
		);
		if (WorkspaceEdit.is(result)) {
			const edit: ApplyWorkspaceEditParams = { edit: result };
			connection?.sendRequest(ApplyWorkspaceEditRequest.type.method, edit);
		} else if (result) {
			connection?.sendNotification(ShowMessageNotification.type.method, {
				message: result,
				type: MessageType.Error,
			});
		}
	});
	connection.onCodeActionResolve((codeAction, cancellationToken) => {
		const data = codeAction.data as TextDocumentIdentifier;
		return pluginHost.resolveCodeAction(data, codeAction, cancellationToken);
	});

	connection.onCompletionResolve((completionItem, cancellationToken) => {
		const data = (completionItem as AppCompletionItem)
			.data as TextDocumentIdentifier;

		if (!data) {
			return completionItem;
		}

		return pluginHost.resolveCompletion(
			data,
			completionItem,
			cancellationToken,
		);
	});

	connection.onSignatureHelp((evt, cancellationToken) =>
		pluginHost.getSignatureHelp(
			evt.textDocument,
			evt.position,
			evt.context,
			cancellationToken,
		),
	);

	connection.onSelectionRanges((evt) =>
		pluginHost.getSelectionRanges(evt.textDocument, evt.positions),
	);

	connection.onImplementation((evt) =>
		pluginHost.getImplementation(evt.textDocument, evt.position),
	);

	connection.onTypeDefinition((evt) =>
		pluginHost.getTypeDefinition(evt.textDocument, evt.position),
	);

	const diagnosticsManager = new DiagnosticsManager(
		connection.sendDiagnostics,
		docManager,
		pluginHost.getDiagnostics.bind(pluginHost),
	);

	const refreshSemanticTokens = debounceThrottle(() => {
		if (
			configManager?.getClientCapabilities()?.workspace?.semanticTokens
				?.refreshSupport
		) {
			connection?.sendRequest(SemanticTokensRefreshRequest.method);
		}
	}, 1500);

	const refreshInlayHints = debounceThrottle(() => {
		if (
			configManager?.getClientCapabilities()?.workspace?.inlayHint
				?.refreshSupport
		) {
			connection?.sendRequest(InlayHintRefreshRequest.method);
		}
	}, 1000);

	const refreshCrossFilesSemanticFeatures = () => {
		diagnosticsManager.scheduleUpdateAll();
		refreshInlayHints();
		refreshSemanticTokens();
	};

	connection.onDidChangeWatchedFiles(onDidChangeWatchedFiles);
	function onDidChangeWatchedFiles(para: DidChangeWatchedFilesParams) {
		const onWatchFileChangesParas = para.changes
			.map((change) => ({
				fileName: urlToPath(change.uri),
				changeType: change.type,
			}))
			.filter((change): change is OnWatchFileChangesPara => !!change.fileName);

		pluginHost.onWatchFileChanges(onWatchFileChangesParas);

		refreshCrossFilesSemanticFeatures();
	}

	connection.onDidSaveTextDocument(diagnosticsManager.scheduleUpdateAll);
	connection.onNotification("$/onDidChangeTsOrJsFile", async (e: any) => {
		const path = urlToPath(e.uri);
		if (path) {
			pluginHost.updateTsOrJsFile(path, e.changes);
		}

		refreshCrossFilesSemanticFeatures();
	});

	connection.onRequest(SemanticTokensRequest.type, (evt, cancellationToken) =>
		pluginHost.getSemanticTokens(
			evt.textDocument,
			undefined,
			cancellationToken,
		),
	);
	connection.onRequest(
		SemanticTokensRangeRequest.type,
		(evt, cancellationToken) =>
			pluginHost.getSemanticTokens(
				evt.textDocument,
				evt.range,
				cancellationToken,
			),
	);

	connection.onRequest(
		LinkedEditingRangeRequest.type,
		async (evt) =>
			await pluginHost.getLinkedEditingRanges(evt.textDocument, evt.position),
	);

	connection.onRequest(InlayHintRequest.type, (evt, cancellationToken) =>
		pluginHost.getInlayHints(evt.textDocument, evt.range, cancellationToken),
	);

	connection.onRequest(
		CallHierarchyPrepareRequest.type,
		async (evt, token) =>
			await pluginHost.prepareCallHierarchy(
				evt.textDocument,
				evt.position,
				token,
			),
	);

	connection.onRequest(
		CallHierarchyIncomingCallsRequest.type,
		async (evt, token) => await pluginHost.getIncomingCalls(evt.item, token),
	);

	connection.onRequest(
		CallHierarchyOutgoingCallsRequest.type,
		async (evt, token) => await pluginHost.getOutgoingCalls(evt.item, token),
	);

	docManager.on(
		"documentChange",
		diagnosticsManager.scheduleUpdate.bind(diagnosticsManager),
	);
	docManager.on("documentClose", (document: Document) =>
		diagnosticsManager.removeDiagnostics(document),
	);

	// The language server protocol does not have a specific "did rename/move files" event,
	// so we create our own in the extension client and handle it here
	connection.onRequest(
		"$/getEditsForFileRename",
		async (fileRename: RenameFile) => pluginHost.updateImports(fileRename),
	);

	connection.onRequest("$/getFileReferences", async (uri: string) => {
		return pluginHost.fileReferences(uri);
	});

	connection.onRequest("$/getComponentReferences", async (uri: string) => {
		return pluginHost.findComponentReferences(uri);
	});

	connection.onRequest("$/getCompiledCode", async (uri: DocumentUri) => {
		const doc = docManager.get(uri);
		if (!doc) {
			return null;
		}

		if (doc) {
			const compiled = await sveltePlugin.getCompiledResult(doc);
			if (compiled) {
				const js = compiled.js;
				const css = compiled.css;
				return { js, css };
			} else {
				return null;
			}
		}
	});

	connection.listen();
}
