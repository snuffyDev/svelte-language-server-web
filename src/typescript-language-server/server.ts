import ts from "typescript";
import {
	CompletionItemKind,
	CompletionList,
	DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import {
	Diagnostic,
	Connection,
	TextDocumentSyncKind,
	Range,
} from "vscode-languageserver/browser";

import { handleFSSync, syncFiles } from "./../features/workspace";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
	readdirSync,
	// @ts-expect-error
	normalizePath,
	realpathSync,
} from "fs";
import { debounce, transformHoverResultToHtml } from "../utils";
import { VFS } from "src/vfs";
import { getTextInRange } from "./documents/utils";
import { WritableDocument } from "./documents/WritableDocument";
import { basename } from "path";

export function scriptElementKindToCompletionItemKind(
	kind: ts.ScriptElementKind,
): CompletionItemKind {
	switch (kind) {
		case ts.ScriptElementKind.primitiveType:
		case ts.ScriptElementKind.keyword:
			return CompletionItemKind.Keyword;
		case ts.ScriptElementKind.constElement:
			return CompletionItemKind.Constant;
		case ts.ScriptElementKind.letElement:
		case ts.ScriptElementKind.variableElement:
		case ts.ScriptElementKind.localVariableElement:
		case ts.ScriptElementKind.alias:
			return CompletionItemKind.Variable;
		case ts.ScriptElementKind.memberVariableElement:
		case ts.ScriptElementKind.memberGetAccessorElement:
		case ts.ScriptElementKind.memberSetAccessorElement:
			return CompletionItemKind.Field;
		case ts.ScriptElementKind.functionElement:
			return CompletionItemKind.Function;
		case ts.ScriptElementKind.memberFunctionElement:
		case ts.ScriptElementKind.constructSignatureElement:
		case ts.ScriptElementKind.callSignatureElement:
		case ts.ScriptElementKind.indexSignatureElement:
			return CompletionItemKind.Method;
		case ts.ScriptElementKind.enumElement:
			return CompletionItemKind.Enum;
		case ts.ScriptElementKind.moduleElement:
		case ts.ScriptElementKind.externalModuleName:
			return CompletionItemKind.Module;
		case ts.ScriptElementKind.classElement:
		case ts.ScriptElementKind.typeElement:
			return CompletionItemKind.Class;
		case ts.ScriptElementKind.interfaceElement:
			return CompletionItemKind.Interface;
		case ts.ScriptElementKind.warning:
		case ts.ScriptElementKind.scriptElement:
			return CompletionItemKind.File;
		case ts.ScriptElementKind.directory:
			return CompletionItemKind.Folder;
		case ts.ScriptElementKind.string:
			return CompletionItemKind.Constant;
	}
	return CompletionItemKind.Property;
}

function displayPartsToString(
	displayParts: ts.SymbolDisplayPart[] | undefined,
): string {
	if (displayParts) {
		return displayParts.map((displayPart) => displayPart.text).join("");
	}
	return "";
}

function tagToString(tag: ts.JSDocTagInfo): string {
	let tagLabel = `*@${tag.name}*`;
	if (tag.name === "param" && tag.text) {
		const [paramName, ...rest] = tag.text;
		tagLabel += `\`${paramName.text}\``;
		if (rest.length > 0) tagLabel += ` — ${rest.map((r) => r.text).join(" ")}`;
	} else if (Array.isArray(tag.text)) {
		tagLabel += ` — ${tag.text.map((r) => r.text).join(" ")}`;
	} else if (tag.text) {
		tagLabel += ` — ${tag.text}`;
	}
	return tagLabel;
}
function _textSpanToRange(model: TextDocument, span: ts.TextSpan): Range {
	let p1 = model.positionAt(span.start);
	let p2 = model.positionAt(span.start + span.length);
	return { start: p1, end: p2 };
}

class Document extends WritableDocument {
	constructor(
		private readonly _uri: string,
		public languageId: string,
		public version: number,
		public content: string,
	) {
		super();
	}

	public get uri(): string {
		return this._uri;
	}

	public getFilePath(): string {
		return this.uri.replace("file:///", "/");
	}

	public getText(range?: Range): string {
		return range ? getTextInRange(range, this.content) : this.content;
	}

	public getURL(): string {
		return new URL(this.uri).toString();
	}

	public setText(text: string): void {
		this.content = text;
	}
}
let currentDir = "";
export const createServer = ({ connection }: { connection: Connection }) => {
	const docs: Record<string, WritableDocument> = {};

	const createLanguageService = () => {
		var fileVersions = new Map();

		let projectVersion = 0;

		function getScriptSnapshot(fileName) {
			var contents = VFS.readFile(fileName, "utf-8");

			if (contents) {
				return ts.ScriptSnapshot.fromString(contents.toString());
			}

			return;
		}

		const getCompilerOptions = () => {
			return ts.parseJsonConfigFileContent(
				ts.readConfigFile("/tsconfig.json", ts.sys.readFile).config,
				ts.sys,
				"/",
				{
					allowJs: true,
					target: ts.ScriptTarget.Latest,
				},
				"/tsconfig.json",
			);
		};

		const compilerOptions: ts.CompilerOptions = {
			...getCompilerOptions().options,
			allowJs: true,
			baseUrl: ".",
			allowNonTsExtensions: true,
			target: ts.ScriptTarget.Latest,
			noEmit: true,
			declaration: false,
			skipLibCheck: true,
		};

		const compilerHost = ts.createCompilerHost(compilerOptions);

		const host: ts.LanguageServiceHost = {
			log: (message) => console.debug(`[ts] ${message}`),
			getCompilationSettings: () => getCompilerOptions().options,
			getScriptFileNames() {
				return Array.from(readdirSync("/")).filter(
					(key) =>
						!key.includes("node_modules") &&
						(key.endsWith(".ts") ||
							key.endsWith(".tsx") ||
							key.endsWith(".js") ||
							key.endsWith(".jsx") ||
							key.endsWith(".js")),
				);
			},
			getCompilerHost() {
				return compilerHost;
			},
			writeFile: VFS.writeFile.bind(VFS),
			realpath: realpathSync,
			getScriptVersion: function getScriptVersion(fileName) {
				return fileVersions.get(fileName) || "0";
			},
			getScriptSnapshot,
			getCurrentDirectory() {
				console.log("get current dir", currentDir);
				return currentDir;
			},
			getDefaultLibFileName: ts.getDefaultLibFilePath,
			fileExists: VFS.fileExists.bind(VFS),
			readFile: (path, encoding) => VFS.readFile(path, encoding).toString(),
			readDirectory: (...args) => {
				console.log(...args);
				return [
					...VFS.readDirectory("/").filter(
						(path) => !path.includes("node_modules"),
					),
					...VFS.readDirectory.bind(VFS)(...args),
				];
			},
			getDirectories: (...args) => {
				console.log(...args);
				return [...VFS.getDirectories.bind(VFS)(...args)];
			},
			useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
			getScriptKind: function getSnapshot(fileName: string) {
				const ext = fileName.split(".").pop();
				switch (ext.toLowerCase()) {
					case ts.Extension.Js:
						return ts.ScriptKind.JS;
					case ts.Extension.Jsx:
						return ts.ScriptKind.JSX;
					case ts.Extension.Ts:
						return ts.ScriptKind.TS;
					case ts.Extension.Tsx:
						return ts.ScriptKind.TSX;
					case ts.Extension.Json:
						return ts.ScriptKind.JSON;
					default:
						return ts.ScriptKind.Unknown;
				}
			},
			getProjectVersion: () => projectVersion.toString(),
			getNewLine: () => ts.sys.newLine,
			...VFS,
		};

		let languageService = ts.createLanguageService(host);

		return {
			...languageService,
			updateFile: (fileName: string, content: string) => {
				fileVersions.set(fileName, (fileVersions.get(fileName) || 0) + 1);

				compilerHost.writeFile(fileName, content, false);
				VFS.writeFile(fileName, content);
				projectVersion++;
				debounce(() => syncFiles(fileName, content), 1000);
			},
			createFile: (fileName: string, content: string) => {
				fileVersions.set(fileName, 0);
				VFS.writeFile(fileName, content);
				compilerHost.writeFile(fileName, content, false);
				projectVersion++;
				debounce(() => syncFiles(fileName, content), 1000);
			},
		};
	};
	let env = createLanguageService();
	handleFSSync((name, contents) => {
		env.updateFile(normalizePath(name), contents);
	});
	globalThis.localStorage = globalThis.localStorage ?? ({} as Storage);

	connection.onInitialize(() => {
		return {
			capabilities: {
				textDocumentSync: {
					openClose: true,

					change: TextDocumentSyncKind.Full,
				},

				completionProvider: {
					resolveProvider: true,
					completionItem: { labelDetailsSupport: true },
				},
				diagnosticProvider: {
					interFileDependencies: true,
					workspaceDiagnostics: true,
				},
				typeHierarchyProvider: true,
				workspace: { workspaceFolders: { supported: true } },
				hoverProvider: true,
				definitionProvider: true,
			},
		};
	});

	// await createTsSystem({}, "", new Map<string, string>([]));
	function updateFile(filePath: string, content: string) {
		env.updateFile(filePath, content);
	}

	function autocompleteAtPosition(
		pos: number,
		filePath: string,
	): CompletionList {
		const result = env.getCompletionsAtPosition(filePath, pos, {
			includeCompletionsForImportStatements: true,
			includeCompletionsForModuleExports: true,
			includeCompletionsWithInsertText: true,
			includePackageJsonAutoImports: "on",
			includeCompletionsWithSnippetText: true,
			useLabelDetailsInCompletionEntries: true,
			allowIncompleteCompletions: false,
		});
		return {
			items: result.entries.map((entry) => {
				return {
					...entry,
					label: entry.name,
					kind: scriptElementKindToCompletionItemKind(entry.kind),
				};
			}),
			isIncomplete: result.isIncomplete,
		};
	}

	function infoAtPosition(pos: number, filePath: string) {
		const result = env.getQuickInfoAtPosition(filePath, pos);

		return result;
	}

	function lintSystem(filePath: string) {
		if (!env) return;

		const SyntacticDiagnostics = env.getSyntacticDiagnostics(filePath);
		const SemanticDiagnostic = env.getSemanticDiagnostics(filePath);
		const SuggestionDiagnostics = env.getSuggestionDiagnostics(filePath);

		const diagnostics: Diagnostic[] = ([] as ts.DiagnosticWithLocation[])
			.concat(SyntacticDiagnostics, SemanticDiagnostic, SuggestionDiagnostics)
			.reduce((acc, result) => {
				type ErrorMessageObj = {
					messageText: string;
					next?: ErrorMessageObj[];
				};
				type ErrorMessage = ErrorMessageObj | string;

				const messagesErrors = (message: ErrorMessage): string[] => {
					if (typeof message === "string") return [message];

					const messageList: string[] = [];
					const getMessage = (loop: ErrorMessageObj) => {
						messageList.push(loop.messageText);

						if (loop.next) {
							loop.next.forEach((item) => {
								getMessage(item);
							});
						}
					};

					getMessage(message);

					return messageList;
				};

				const severity: Diagnostic["severity"][] = [
					DiagnosticSeverity.Warning,
					DiagnosticSeverity.Error,
					DiagnosticSeverity.Information,
					DiagnosticSeverity.Hint,
				];

				messagesErrors(result.messageText).forEach((message) => {
					acc.push({
						range: _textSpanToRange(docs[`file://${filePath}`], result),
						message,
						source: result?.source || "ts",
						severity: severity[result.category],
						// actions: codeActions as any as Diagnostic["actions"]
					});
				});

				return acc;
			}, [] as Diagnostic[]);

		// return { items: diagnostics };
		connection.sendDiagnostics({ uri: `file://${filePath}`, diagnostics });
	}

	connection.onDidOpenTextDocument((params) => {
		const filePath = normalizePath(params.textDocument.uri);
		const content = params.textDocument.text;

		if (!docs[params.textDocument.uri]) {
			docs[params.textDocument.uri] = new Document(
				params.textDocument.uri,
				params.textDocument.languageId,
				params.textDocument.version,
				content,
			);
		}
		currentDir = basename(filePath);
		updateFile(filePath, content);
		lintSystem(filePath);
		syncFiles(filePath, content);
	});

	connection.onDidChangeTextDocument((params) => {
		const filePath = normalizePath(params.textDocument.uri);
		const content = params.contentChanges[0].text;
		docs[params.textDocument.uri].update(content, 0, content.length);
		docs[params.textDocument.uri].version++;

		updateFile(filePath, content);
		lintSystem(filePath);

		syncFiles(filePath, content);
	});

	connection.onCompletion((params) => {
		const filePath = normalizePath(params.textDocument.uri);

		return autocompleteAtPosition(
			docs[params.textDocument.uri].offsetAt(params.position),
			filePath,
		);
	});

	connection.onHover(({ textDocument, position }) => {
		const filePath = normalizePath(textDocument.uri);

		const sourceDoc = docs[textDocument.uri];

		const info = infoAtPosition(sourceDoc.offsetAt(position), filePath);

		if (!info) {
			return;
		}

		const documentation = displayPartsToString(info.documentation);
		const tags = info.tags
			? info.tags.map((tag) => tagToString(tag)).join("  \n\n")
			: "";
		const contents = displayPartsToString(info.displayParts);
		return transformHoverResultToHtml({
			range: _textSpanToRange(docs[textDocument.uri], info.textSpan),
			contents: [
				{
					language: "typescript",
					value: "```typescript\n" + contents + "\n```\n",
				},
				{
					language: "typescript",

					value: documentation + (tags ? "\n\n" + tags : ""),
				},
			],
		});
	});

	connection.listen();
};
