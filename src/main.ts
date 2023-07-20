import { basicSetup } from "codemirror";
import "./style.css";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { syntaxHighlighting } from "@codemirror/language";
import { Annotation, EditorState, Text, Transaction } from "@codemirror/state";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
// import TSWorker from "./worker?worker";
import { svelte } from "@replit/codemirror-lang-svelte";
import PostMessageWorkerTransport from "./transport.js";
import {
	LanguageServerClient,
	languageServer,
	languageServerWithTransport,
} from "codemirror-languageserver";
// @ts-ignore
import {
	oneDark,
	oneDarkHighlightStyle,
	oneDarkTheme,
} from "@codemirror/theme-one-dark";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import Prism from "prismjs";
import { languages } from "prismjs/components";
import hljs from "highlight.js";
Prism.disableWorkerMessageHandler = true;
marked.use({
	extensions: markedHighlight({
		highlight: (input) => hljs.highlight(input, { language: "svelte" }).value,
	}).extensions,
});
const nav = document.querySelector("nav");

const SvelteWorker = () =>
	new Worker(new URL("./worker.ts", import.meta.url), {
		type: "module",
	});
// console.log(new URL("./worker.mjs", import.meta.url), {
// type: "module",
// });
const [button1, button2] = nav.querySelectorAll<HTMLButtonElement>("button");

const hoverMarked = hoverTooltip((view, pos, side) => {
	let { from, to, text } = view.state.doc.lineAt(pos);
	let start = pos,
		end = pos;
	while (start > from && /\w/.test(text[start - from - 1])) start--;
	while (end < to && /\w/.test(text[end - from])) end++;
	if ((start == pos && side < 0) || (end == pos && side > 0)) return null;
	return {
		pos: start,
		end,
		above: true,
		create(view) {
			let dom = document.createElement("div");
			dom.innerHTML = text.slice(start - from, end - from);

			// console.log(dom.innerHTML);

			return {
				dom,
				mount: () => {},
			};
		},
	};
});

const files = {
	"Comp1.svelte": `<script lang="ts">
	function add(a, b) {
		return a + b;
	}

	console.log(add(3, 5));
</script>

  `,
	"App.svelte":
		"<" +
		`script` +
		` lang="ts">
	import { onMount } from 'svelte';

	let photos: Array<{thumbnailUrl: string, title: string}> = [];

	onMount(async () => {
		const res = await fetch(\`/tutorial/api/album\`);
		photos = await res.json();
	});
</script>

<h1>Photo album</h1>

<div class="photos">
	{#each photos as photo}
		<figure>
			<img src={photo.thumbnailUrl} alt={photo.title} />
			<figcaption>{photo.title}</figcaption>
		</figure>
	{:else}
		<!-- this block renders when photos.length === 0 -->
		<p>loading...</p>
	{/each}
</div>

<style>
	.photos {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		grid-gap: 8px;
	}

	figure,
	img {
		width: 100%;
		margin: 0;
	}
</style>
`,
};
// Create a web worker from the TypeScript language
// const fs = await getFs.writeFile("index.ts", files["index.ts"]);
// console.log(fs);
// const worker = new TSWorker();
const svelteWorker = SvelteWorker;
const transport = new PostMessageWorkerTransport(svelteWorker());
console.log(svelteWorker);
// const yamlTransport = new PostMessageWorkerTransport(worker) as any;
// const svelteTransport = ;
// const client = new LanguageServerClient(DEFAULT_OPTIONS);

const DEFAULT_OPTIONS = {};
const STATES = new Map<`file:///${keyof typeof files}`, EditorView>();

let code = files["App.svelte"];
const watcher = EditorView.updateListener.of((viewUpdate) => {
	if (viewUpdate.selectionSet) {
		code = viewUpdate.state.doc.toString();
	}

	console.log({ viewUpdate, code });
});

const ls = new LanguageServerClient({
	transport,
	rootUri: "/",
	documentUri: "/",
	languageId: "",
	workspaceFolders: [{ name: "root", uri: "/" }],
});

// const state = EditorState.create({
// 	extensions: [
// 		basicSetup,
// 		tokyoNight,
// 		watcher,
// 		keymap.of(vscodeKeymap),
// 		typescriptLanguage,
// 		languageServerWithTransport({
// 			transport: yamlTransport,
// 			rootUri: "file:///",
// 			workspaceFolders: null,
// 			documentUri: `file:///index.ts`,
// 			languageId: "typescript",
// 		}),
// 	],
// });
// const ls = languageServerWithTransport({
// 	transport: svelteTransport,
// 	rootUri: "file:///",
// 	workspaceFolders: [{ name: "Root", uri: "file:///" }],
// 	documentUri: "file:///index.svelte",

// 	languageId: "svelte",
// });
/**
 *
 *
 * @param uri
 */
const createEditorState = (uri: string) =>
	EditorState.create({
		extensions: [
			basicSetup,
			watcher,
			languageServerWithTransport({
				transport,
				documentUri: uri,
				languageId: uri.includes("svelte") ? "svelte" : "typescript",
				workspaceFolders: [{ name: "root", uri: "/" }],
				rootUri: "/",
				allowHTMLContent: true,
				autoClose: false,
				client: ls,
			}),
			keymap.of(vscodeKeymap),
			oneDark,
			svelte(),
			hoverMarked,
		],
	});

// console.log(StyleoneDarkTheme);
STATES.set("file:///App.svelte", createEditorState("file:///App.svelte"));
// Create the editor with basic setup and TypeScript language server integration
const editor = new EditorView({
	state: STATES.get("file:///App.svelte"),
	parent: document.getElementById("editor"),
	extensions: [],
});

button1.onclick = () => {
	const file = editor.state.doc.toString();
	STATES.set("file:///Comp1.svelte", editor.state);

	if (!STATES.has("file:///App.svelte")) {
		code = files["App.svelte"];
		STATES.set("file:///App.svelte", createEditorState("file:///App.svelte"));
	} else {
		files["Comp1.svelte"] = file;
		code = files["App.svelte"];
	}
	const newState = STATES.get("file:///App.svelte");
	// STATES.set("file:///index.ts", code);
	editor.setState(newState);
	editor.dispatch({
		changes: { from: 0, to: editor.state.doc.length, insert: code },
	});
};
const useLast = (values: readonly any[]) => values.reduce((_, v) => v, "");

button2.onclick = () => {
	const file = editor.state.doc.toString();
	// console.log(editor, editor.state);
	STATES.set("file:///App.svelte", editor.state);
	if (!STATES.has("file:///Comp1.svelte")) {
		STATES.set(
			"file:///Comp1.svelte",
			createEditorState("file:///Comp1.svelte"),
		);
	} else {
		// code = files["Comp1.svelte"];
	}
	files["App.svelte"] = file;
	code = files["Comp1.svelte"];

	// editor.dispatch({ changes: { from: 0, to: 0, insert: code } });
	const newState = STATES.get("file:///Comp1.svelte");
	editor.setState(newState);
	editor.dispatch({
		changes: { from: 0, to: editor.state.doc.length, insert: code },
	});
	// STATES.set("file:///index.ts", code);
};

// Create the editor with state and TypeScript/Svelte language server integration
// const editor = news

// Sample code to display in the editor
code = files["App.svelte"];

let syncAnnotation = Annotation.define<boolean>();
// Set the initial content of the editor
function syncDispatch() {
	view.update([tr]);
	if (!tr.changes.empty && !tr.annotation(syncAnnotation)) {
		// otherView.dispatch({
		// 	changes: tr.changes,
		// })
	}
}

editor.dispatch({ changes: { to: 0, from: 0, insert: code } });
