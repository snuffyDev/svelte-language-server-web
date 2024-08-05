// import { WorkerRPC } from "./WorkerRPC";
// import * as monaco from "monaco-editor";
// import WorkerURL from "./worker.mjs?url";
// import { initServices } from "monaco-languageclient/vscode/services";
// import { CompletionList, Hover, Position } from "vscode-languageserver/browser";
// import { useWorkerFactory } from "monaco-editor-wrapper/workerFactory";
// import projectJSON from "../../../project-modules.json";

// // Unescape project entries
// const project = Object.fromEntries(
// 	Object.entries(projectJSON).map(([key, value]) => [key, unescape(value)]),
// );
// const init_files = {
// 	"file:///package.json": project["/package.json"],
// 	...Object.fromEntries(
// 		Object.entries(project).map(([key, value]) => [`file://${key}`, value]),
// 	),
// };

// export const configureMonacoWorkers = () => {
// 	// Override the worker factory with your own direct definition
// 	useWorkerFactory({
// 		ignoreMapping: true,
// 		workerLoaders: {
// 			editorWorkerService: () =>
// 				new Worker(
// 					new URL(
// 						"monaco-editor/esm/vs/editor/editor.worker.js",
// 						import.meta.url,
// 					),
// 					{ type: "module" },
// 				),
// 		},
// 	});
// };

// export async function initMonacoEditor() {
// 	await initServices({});
// 	configureMonacoWorkers();

// 	const svelteLanguageId = "svelte";

// 	// Register Svelte language
// 	monaco.languages.register({
// 		id: svelteLanguageId,
// 		extensions: [".svelte"],
// 		aliases: ["Svelte", "svelte"],
// 		mimetypes: ["text/x-svelte"],
// 	});

// 	// Initialize the Monaco Editor
// 	const model = monaco.editor.createModel(
// 		init_files["file:///src/routes/+page.svelte"],
// 		"svelte",
// 		monaco.Uri.file("/src/routes/+page.svelte"),
// 	);
// 	const editor = monaco.editor.create(document.getElementById("container")!, {
// 		model: model,
// 		language: svelteLanguageId,
// 		theme: "vs-dark",
// 		automaticLayout: true,
// 		tabSize: 2,
// 		insertSpaces: true,
// 	});

// 	// Initialize the Monaco Language Client
// 	const rpc = new WorkerRPC(new URL(WorkerURL, import.meta.url), {
// 		documentUri: "",
// 		workspaceFolders: [{ name: "root", uri: "file:///" }],
// 		rootUri: "file:///",
// 		allowHTMLContent: true,
// 		autoClose: false,
// 		languageId: "svelte",
// 	});

// 	const languageClient = await rpc.client();

// 	await new Promise((resolve) => setTimeout(resolve, 50));
// 	await rpc.addFiles(init_files);
// 	await rpc.setup({ ...init_files });

// 	console.log("Language Client started");
// 	monaco.editor.setModelLanguage(model, "svelte");
// 	languageClient.start();

// 	await new Promise((resolve) => {
// 		setTimeout(() => {
// 			editor.setModel(model);
// 			resolve();
// 		}, 500);
// 	});

// 	monaco.languages.onLanguage("svelte", () => {
// 		console.log("Svelte");
// 		setTimeout(() => {});
// 	});

// 	if (model) {
// 		editor.setModel(model);
// 		editor.setValue(model.getValue());

// 		await languageClient.sendNotification("textDocument/didOpen", {
// 			textDocument: {
// 				uri: model.uri.toString(),
// 				languageId: "svelte",
// 				version: model.getVersionId(),
// 				text: model.getValue(),
// 			},
// 		});

// 		await languageClient.sendNotification("textDocument/didChange", {
// 			textDocument: {
// 				uri: model.uri.toString(),
// 				version: model.getVersionId(),
// 			},
// 			contentChanges: [
// 				{
// 					range: {
// 						start: { line: 0, character: 0 },
// 						end: { line: model.getLineCount(), character: 0 },
// 					},
// 					rangeLength: 0,
// 					text: model.getValue(),
// 				},
// 			],
// 		});

// 		languageClient.onNotification(
// 			"textDocument/publishDiagnostics",
// 			(params) => {
// 				monaco.editor.setModelMarkers(model, "svelte", params.diagnostics);
// 			},
// 		);

// 		model.onDidChangeContent(() => {
// 			console.log("Content changed");

// 			languageClient.sendNotification("textDocument/didChange", {
// 				textDocument: {
// 					uri: model.uri.toString(),
// 					version: model.getVersionId(),
// 				},
// 				contentChanges: [
// 					{
// 						range: {
// 							start: { line: 0, character: 0 },
// 							end: { line: model.getLineCount(), character: 0 },
// 						},
// 						rangeLength: 0,
// 						text: model.getValue(),
// 					},
// 				],
// 			});
// 		});

// 		languageClient.onNotification(
// 			"textDocument/publishDiagnostics",
// 			(params) => {
// 				monaco.editor.setModelMarkers(model, "svelte", params.diagnostics);
// 			},
// 		);
// 	}

// 	// Set Svelte language configuration
// 	monaco.languages.setLanguageConfiguration(svelteLanguageId, {
// 		comments: {
// 			lineComment: "//",
// 			blockComment: ["/*", "*/"],
// 		},
// 		brackets: [
// 			["{", "}"],
// 			["[", "]"],
// 			["(", ")"],
// 			["<", ">"],
// 		],
// 		autoClosingPairs: [
// 			{ open: "{", close: "}" },
// 			{ open: "[", close: "]" },
// 			{ open: "(", close: ")" },
// 			{ open: '"', close: '"', notIn: ["string"] },
// 			{ open: "'", close: "'", notIn: ["string", "comment"] },
// 			{ open: "`", close: "`", notIn: ["string"] },
// 			{ open: "/**", close: " */", notIn: ["string"] },
// 		],
// 		surroundingPairs: [
// 			{ open: "{", close: "}" },
// 			{ open: "[", close: "]" },
// 			{ open: "(", close: ")" },
// 			{ open: '"', close: '"' },
// 			{ open: "'", close: "'" },
// 			{ open: "<", close: ">" },
// 		],
// 		folding: {
// 			markers: {
// 				start: new RegExp("^\\s*//\\s*#?region\\b"),
// 				end: new RegExp("^\\s*//\\s*#?endregion\\b"),
// 			},
// 		},
// 	});

// 	// Register language providers
// 	monaco.languages.registerCompletionItemProvider(svelteLanguageId, {
// 		async provideCompletionItems(model, position) {
// 			const completionList = await languageClient.sendRequest<CompletionList>(
// 				"textDocument/completion",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 					position: Position.create(position.lineNumber, position.column),
// 				},
// 			);
// 			return {
// 				suggestions: completionList.items || [],
// 				incomplete: completionList.isIncomplete || false,
// 			};
// 		},
// 	});

// 	monaco.languages.registerHoverProvider(svelteLanguageId, {
// 		async provideHover(model, position) {
// 			const hover = await languageClient.sendRequest<Hover>(
// 				"textDocument/hover",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 					position: { line: position.lineNumber, character: position.column },
// 				},
// 			);
// 			return hover;
// 		},
// 	});

// 	monaco.languages.registerSignatureHelpProvider(svelteLanguageId, {
// 		async provideSignatureHelp(model, position) {
// 			const signatureHelp = await languageClient.sendRequest(
// 				"textDocument/signatureHelp",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 					position: Position.create(position.lineNumber, position.column),
// 				},
// 			);
// 			return signatureHelp;
// 		},
// 	});

// 	monaco.languages.registerDefinitionProvider(svelteLanguageId, {
// 		async provideDefinition(model, position) {
// 			const definition = await languageClient.sendRequest(
// 				"textDocument/definition",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 					position: Position.create(position.lineNumber, position.column),
// 				},
// 			);
// 			return definition;
// 		},
// 	});

// 	monaco.languages.registerReferenceProvider(svelteLanguageId, {
// 		async provideReferences(model, position) {
// 			const references = await languageClient.sendRequest(
// 				"textDocument/references",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 					position: Position.create(position.lineNumber, position.column),
// 				},
// 			);
// 			return references;
// 		},
// 	});

// 	monaco.languages.registerDocumentFormattingEditProvider(svelteLanguageId, {
// 		async provideDocumentFormattingEdits(model) {
// 			const edits = await languageClient.sendRequest(
// 				"textDocument/formatting",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 					options: {
// 						tabSize: 2,
// 						insertSpaces: true,
// 					},
// 				},
// 			);
// 			return edits;
// 		},
// 	});

// 	monaco.languages.registerDocumentSemanticTokensProvider(svelteLanguageId, {
// 		async provideDocumentSemanticTokens(model) {
// 			const tokens = await languageClient.sendRequest(
// 				"textDocument/semanticTokens",
// 				{
// 					textDocument: { uri: model.uri.toString() },
// 				},
// 			);
// 			return tokens;
// 		},
// 	});
// }

// initMonacoEditor();
