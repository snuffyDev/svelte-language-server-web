import * as monaco from "monaco-editor";
import { useWorkerFactory } from "monaco-editor-wrapper/workerFactory";

export const configureMonacoWorkers = () => {
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

export const createEditor = (
	containerId: string,
	model: monaco.editor.ITextModel,
	language: string,
) => {
	const editor = monaco.editor.create(document.getElementById(containerId)!, {
		model: model,

		language: language,
		theme: "vs-dark",
		tabSize: 2,
		insertSpaces: true,
	});

	return editor;
};

export type EditorParams = {
	containerId: string;
	model: monaco.editor.ITextModel;
	language: string;
};

export function initMonacoEditor({
	containerId,
	model,
	language,
}: EditorParams) {
	const editor = createEditor(containerId, model, language);

	return { editor, model };
}
