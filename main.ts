import "./style.css";

import { basicSetup } from "codemirror";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { svelte } from "@replit/codemirror-lang-svelte";
import PostMessageWorkerTransport from "./src/transport.js";
import {
	LanguageServerClient,
	languageServerWithTransport,
} from "codemirror-languageserver";
// @ts-expect-error
import Worker from "./main_worker?worker";
import { oneDark } from "@codemirror/theme-one-dark";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

marked.use({
	extensions: markedHighlight({
		highlight: (input) => hljs.highlight(input, { language: "svelte" }).value,
	}).extensions,
});

const nav = document.querySelector("nav");
const [button1, button2] = nav!.querySelectorAll<HTMLButtonElement>("button");

const SvelteWorker = () => new Worker();

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

const svelteWorker = SvelteWorker;
const transport = new PostMessageWorkerTransport(svelteWorker());

const states = new Map<`file:///${keyof typeof files}`, EditorState>();

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

states.set("file:///App.svelte", createEditorState("file:///App.svelte"));

// Create the editor with basic setup and Svelte language server integration
const editor = new EditorView({
	state: states.get("file:///App.svelte"),
	parent: document.getElementById("editor")!,
	extensions: [],
});

button1.onclick = () => {
	const file = editor.state.doc.toString();
	states.set("file:///Comp1.svelte", editor.state);

	if (!states.has("file:///App.svelte")) {
		code = files["App.svelte"];
		states.set("file:///App.svelte", createEditorState("file:///App.svelte"));
	} else {
		files["Comp1.svelte"] = file;
		code = files["App.svelte"];
	}
	const newState = states.get("file:///App.svelte");

	editor.setState(newState!);
	editor.dispatch({
		changes: { from: 0, to: editor.state.doc.length, insert: code },
	});
};

button2.onclick = () => {
	const file = editor.state.doc.toString();
	states.set("file:///App.svelte", editor.state);
	if (!states.has("file:///Comp1.svelte")) {
		states.set(
			"file:///Comp1.svelte",
			createEditorState("file:///Comp1.svelte"),
		);
	}

	files["App.svelte"] = file;
	code = files["Comp1.svelte"];

	const newState = states.get("file:///Comp1.svelte");
	editor.setState(newState!);
	editor.dispatch({
		changes: { from: 0, to: editor.state.doc.length, insert: code },
	});
};

// Current document to display in the editor
code = files["App.svelte"];

editor.dispatch({ changes: { to: 0, from: 0, insert: code } });
