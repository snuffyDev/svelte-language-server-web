import { initMonacoEditor } from "./_monaco";
import { configureSvelteLanguage } from "./svelteLanguage";
import * as monaco from "monaco-editor";
import projectJSON from "../../../project.json";
import { setupDocument } from "./documentSetup";
import { initServices } from "monaco-languageclient/vscode/services";

const json = projectJSON as Record<string, string>;

// Unescape project entries
const project = Object.fromEntries(
	Object.entries(projectJSON).map(([key, value]) => [
		key,
		unescape(
			value.replace(/%[0-9A-F]/g, (match) =>
				String.fromCharCode(parseInt(match.slice(1), 16)),
			),
		),
	]),
);
const init_files = {
	"/package.json": project["/package.json"],
	...Object.fromEntries(
		Object.entries(project).map(([key, value]) => [`${key}`, value]),
	),
} as Record<string, string>;

const EDITOR_MODELS: Map<string, monaco.editor.ITextModel> = new Map();

const createModel = (
	fsPath: string,
	initialModelContent: string,
	language: string,
) => {
	const model = monaco.editor.createModel(
		initialModelContent,
		language,
		monaco.Uri.file(fsPath),
	);
	return model;
};

const swapModel = (
	editor: monaco.editor.IStandaloneCodeEditor,
	model: monaco.editor.ITextModel,
) => {
	const oldModel = editor.getModel();
	if (oldModel) {
		oldModel.dispose();
	}
	editor.setModel(model);
};

async function main() {
	await initServices({});

	let { editor, model } = initMonacoEditor({
		containerId: "container",
		model: createModel(
			"/src/routes/+page.svelte",
			json["/src/routes/+page.svelte"],
			"svelte",
		),
		language: "svelte",
	});
	const { languageClient } = await configureSvelteLanguage(
		editor,
		model,
		init_files,
	);

	setupDocument(init_files, (_oldPath, newPath) => {
		const newModel =
			EDITOR_MODELS.get(newPath) ??
			createModel(newPath, init_files[newPath], "svelte");
		if (newModel) {
			swapModel(editor, newModel);

			languageClient.sendNotification("textDocument/didOpen", {
				textDocument: {
					uri: newModel.uri.toString(),
					languageId: "svelte",
					version: newModel.getVersionId(),
					text: newModel.getValue(),
				},
			});

			model = newModel;
		}
	});

	console.log("Svelte Language Server started");
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Add initial model to the Map
	EDITOR_MODELS.set("/src/routes/+page.svelte", model);

	editor.setModel(model);
}
if (typeof window !== "undefined") main();
