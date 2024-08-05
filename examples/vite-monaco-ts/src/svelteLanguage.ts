import * as monaco from "monaco-editor";
import { WorkerRPC } from "./WorkerRPC";
import {
	CompletionList,
	Hover,
	HoverParams,
	Position,
} from "vscode-languageserver/browser";
import { useWorkerFactory } from "monaco-editor-wrapper/workerFactory";

const configureMonacoWorkers = () => {
	// Override the worker factory with your own direct definition
	useWorkerFactory({
		ignoreMapping: true,
		workerLoaders: {
			editorWorkerService: () =>
				new Worker(
					new URL(
						"monaco-editor/esm/vs/editor/editor.worker.js",
						import.meta.url,
					),
					{ type: "module" },
				),
		},
	});
};
// Unescape project entries
// replace the %[0-9A-F]{2} with the actual character

export async function configureSvelteLanguage(
	editor: monaco.editor.IStandaloneCodeEditor,
	model: monaco.editor.ITextModel,
	files: Record<string, string>,
) {
	configureMonacoWorkers();
	const svelteLanguageId = "svelte";

	// Register Svelte language
	monaco.languages.register({
		id: svelteLanguageId,
		extensions: [".svelte"],
		aliases: ["Svelte", "svelte"],
		mimetypes: ["text/x-svelte"],
	});

	// Initialize the Monaco Language Client
	const rpc = new WorkerRPC(new URL("./worker.mjs", import.meta.url), {
		documentUri: "",
		workspaceFolders: [{ name: "root", uri: "file:///" }],
		rootUri: "file:///",
		allowHTMLContent: true,
		autoClose: false,
		languageId: "svelte",
	});

	const languageClient = await rpc.client();

	await new Promise((resolve) => setTimeout(resolve, 50));
	await rpc.addFiles(files);
	await rpc.setup({ ...files });

	if (model) {
		languageClient.sendNotification("textDocument/didOpen", {
			textDocument: {
				uri: model.uri.toString(),
				languageId: "svelte",
				version: model.getVersionId(),
				text: model.getValue(),
			},
		});

		languageClient.sendNotification("textDocument/didChange", {
			textDocument: {
				uri: model.uri.toString(),
				version: model.getVersionId(),
			},
			contentChanges: [
				{
					range: {
						start: { line: 0, character: 0 },
						end: { line: model.getLineCount(), character: 0 },
					},
					rangeLength: 0,
					text: model.getValue(),
				},
			],
		});

		languageClient.onNotification(
			"textDocument/publishDiagnostics",
			(params) => {
				monaco.editor.setModelMarkers(model, "svelte", params.diagnostics);
			},
		);

		model.onDidChangeContent(() => {
			console.log("Content changed");
			languageClient.sendNotification("textDocument/didChange", {
				textDocument: {
					uri: model.uri.toString(),
					version: model.getVersionId(),
				},
				contentChanges: [
					{
						range: {
							start: { line: 0, character: 0 },
							end: { line: model.getLineCount(), character: 0 },
						},
						rangeLength: 0,
						text: model.getValue(),
					},
				],
			});
		});

		languageClient.onNotification(
			"textDocument/publishDiagnostics",
			(params) => {
				monaco.editor.setModelMarkers(model, "svelte", params.diagnostics);
			},
		);
	}

	// Set Svelte language configuration
	monaco.languages.setLanguageConfiguration(svelteLanguageId, {
		comments: {
			lineComment: "//",
			blockComment: ["/*", "*/"],
		},
		brackets: [
			["{", "}"],
			["[", "]"],
			["(", ")"],
			["<", ">"],
		],
		autoClosingPairs: [
			{ open: "{", close: "}" },
			{ open: "[", close: "]" },
			{ open: "(", close: ")" },
			{ open: '"', close: '"', notIn: ["string"] },
			{ open: "'", close: "'", notIn: ["string", "comment"] },
			{ open: "`", close: "`", notIn: ["string"] },
			{ open: "/**", close: " */", notIn: ["string"] },
		],
		surroundingPairs: [
			{ open: "{", close: "}" },
			{ open: "[", close: "]" },
			{ open: "(", close: ")" },
			{ open: '"', close: '"' },
			{ open: "'", close: "'" },
			{ open: "<", close: ">" },
		],
		folding: {
			markers: {
				start: new RegExp("^\\s*//\\s*#?region\\b"),
				end: new RegExp("^\\s*//\\s*#?endregion\\b"),
			},
		},
	});

	// Register language providers
	monaco.languages.registerCompletionItemProvider(svelteLanguageId, {
		async provideCompletionItems(model, position) {
			const completionList = await languageClient.sendRequest<CompletionList>(
				"textDocument/completion",
				{
					textDocument: { uri: model.uri.toString() },
					position: Position.create(position.lineNumber, position.column),
				},
			);
			return {
				suggestions: completionList.items || [],
				incomplete: completionList.isIncomplete || false,
			};
		},
	});

	monaco.languages.registerHoverProvider(svelteLanguageId, {
		async provideHover(model, position) {
			const hover = await languageClient.sendRequest<Hover>(
				"textDocument/hover",
				{
					textDocument: { uri: model.uri.toString() },
					position: { line: position.lineNumber, character: position.column },
				},
			);
			return hover;
		},
	});

	monaco.languages.registerSignatureHelpProvider(svelteLanguageId, {
		async provideSignatureHelp(model, position) {
			const signatureHelp = await languageClient.sendRequest(
				"textDocument/signatureHelp",
				{
					textDocument: { uri: model.uri.toString() },
					position: Position.create(position.lineNumber, position.column),
				},
			);
			return signatureHelp;
		},
	});

	monaco.languages.registerDefinitionProvider(svelteLanguageId, {
		async provideDefinition(model, position) {
			const definition = await languageClient.sendRequest(
				"textDocument/definition",
				{
					textDocument: { uri: model.uri.toString() },
					position: Position.create(position.lineNumber, position.column),
				},
			);
			return definition;
		},
	});

	monaco.languages.registerReferenceProvider(svelteLanguageId, {
		async provideReferences(model, position) {
			const references = await languageClient.sendRequest(
				"textDocument/references",
				{
					textDocument: { uri: model.uri.toString() },
					position: Position.create(position.lineNumber, position.column),
				},
			);
			return references;
		},
	});

	monaco.languages.registerDocumentFormattingEditProvider(svelteLanguageId, {
		async provideDocumentFormattingEdits(model) {
			const edits = await languageClient.sendRequest(
				"textDocument/formatting",
				{
					textDocument: { uri: model.uri.toString() },
					options: {
						tabSize: 2,
						insertSpaces: true,
					},
				},
			);
			return edits;
		},
	});

	monaco.languages.registerDocumentSemanticTokensProvider(svelteLanguageId, {
		async provideDocumentSemanticTokens(model) {
			const tokens = await languageClient.sendRequest(
				"textDocument/semanticTokens",
				{
					textDocument: { uri: model.uri.toString() },
				},
			);
			return tokens;
		},
	});

	return {
		rpc,
		languageClient,
	};
}
