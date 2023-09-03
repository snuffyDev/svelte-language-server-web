import "./style.css";

import { basicSetup } from "codemirror";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { EditorState, Extension } from "@codemirror/state";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { svelte } from "@replit/codemirror-lang-svelte";
import { WorkerRPC } from "./dist";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import {
	LanguageServerClient,
	languageServerWithTransport,
} from "codemirror-languageserver";

//@ts-expect-error
import SvelteWorker from "./main_worker?worker";
//@ts-expect-error
import TSWorker from "./main_ts_worker?worker";
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
const [button1, button2, button3] =
	nav!.querySelectorAll<HTMLButtonElement>("button");

let currentTab = "";

const svelteWorker: Worker = new SvelteWorker();
const tsWorker: Worker = new TSWorker();
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

const init_files = {
	"file:///.svelte-kit/tsconfig.json": `{
		"compilerOptions": {
			"paths": {
				"$stores": [
					"../src/lib/stores"
				],
				"$stores/*": [
					"../src/lib/stores/*"
				],
				"$api": [
					"../src/routes/(app)/api/_lib"
				],
				"$api/*": [
					"../src/routes/(app)/api/_lib/*"
				],
				"$components": [
					"../src/lib/components"
				],
				"$components/*": [
					"../src/lib/components/*"
				],
				"$env": [
					"../src/env.ts"
				],
				"$lib": [
					"../src/lib"
				],
				"$lib/*": [
					"../src/lib/*"
				]
			},
			"rootDirs": [
				"..",
				"./types"
			],
			"importsNotUsedAsValues": "error",
			"isolatedModules": true,
			"preserveValueImports": true,
			"lib": [
				"esnext",
				"DOM",
				"DOM.Iterable"
			],
			"moduleResolution": "node",
			"module": "esnext",
			"target": "esnext",
			"ignoreDeprecations": "5.0"
		},
		"include": [
			"ambient.d.ts",
			"./types/**/$types.d.ts",
			"../vite.config.ts",
			"../src/**/*.js",
			"../src/**/*.ts",
			"../src/**/*.svelte",
			"../tests/**/*.js",
			"../tests/**/*.ts",
			"../tests/**/*.svelte"
		],
		"exclude": [
			"../node_modules/**",
			"./[!ambient.d.ts]**",
			"../src/service-worker.js",
			"../src/service-worker.ts",
			"../src/service-worker.d.ts"
		]
	}`,
	"file:///tsconfig.json": `{
		"extends": "./.svelte-kit/tsconfig.json",
		"compilerOptions": {
			"esModuleInterop": true,
			"strict": true,
			"strictFunctionTypes": true,
			"noUnusedLocals": true,
			"strictNullChecks": true,
			"paths": {
				"$components/*": ["./src/lib/components/*"],
				"$stores/*": ["./src/lib/stores/*"],
				"$api/*": ["./src/routes/(app)/api/_lib/*"],
				"$lib": ["./src/lib"],
				"$lib/*": ["./src/lib/*"],
				"$env": ["./src/env.ts"],
				"$app/*": ["./.svelte-kit/runtime/app/*"]
			}
		},
		"ts-node": {
			"compilerOptions": {
				"allowSyntheticDefaultImports": true,
				"resolveJsonModule": true
			},
			"moduleTypes": {}
		},
		"exclude": ["scripts/**/*.*", "node_modules/**"]
	}

	`,
	"file:///package.json": `{
		"name": "svelte-language-server-web",
		"private": true,
		"version": "0.0.0",
		"type": "module",
		"types": "./dist/index.d.ts",
		"module": "./src/index.ts",
		"scripts": {
			"dev": "NODE_ENV=testing vite",
			"prestart": "npm run build:setup",
			"build": "NODE_ENV=production node esbuild.js",
			"build:dev": "NODE_ENV=development node esbuild.js",
			"build:testing": "NODE_ENV=testing node esbuild.js",
			"postinstall": "cd node_modules/@open-rpc/client-js && tsc --noEmitOnError false",
			"build:ls": "",
			"build:frontend": "node --max_old_space_size=16384 ./node_modules/vite/bin/vite.js build",
			"prepublishOnly": "node scripts/generate-dts-bundle.js",
			"preview": "vite preview"
		},
		"files": [
			"dist"
		],
		"devDependencies": {
			"@codemirror/lang-html": "^6.4.5",
			"@codemirror/lang-javascript": "^6.1.9",
			"@codemirror/language": "^6.8.0",
			"@codemirror/lint": "^6.3.0",
			"@codemirror/state": "^6.2.1",
			"@codemirror/theme-one-dark": "^6.1.2",
			"@codemirror/view": "^6.14.0",
			"@ddietr/codemirror-themes": "^1.4.1",
			"@jridgewell/trace-mapping": "^0.3.17",
			"@open-rpc/client-js": "^1.8.1",
			"@replit/codemirror-lang-svelte": "^6.0.0",
			"@replit/codemirror-vscode-keymap": "^6.0.2",
			"@subframe7536/vite-plugin-ngmi-polyfill": "^0.1.0",
			"@swc/cli": "^0.1.62",
			"@swc/core": "^1.3.70",
			"@types/marked": "^5.0.0",
			"@types/node": "^20.3.3",
			"@types/prismjs": "^1.26.0",
			"@typescript/vfs": "^1.4.0",
			"@vscode/emmet-helper": "2.8.4",
			"chokidar": "^3.4.1",
			"codemirror": "^6.0.1",
			"codemirror-languageserver": "^1.11.0",
			"dts-buddy": "^0.1.8",
			"dts-bundle-generator": "^8.0.1",
			"esbuild": "^0.18.15",
			"esbuild-plugin-d-ts-path-alias": "^4.2.0",
			"esbuild-plugin-d.ts": "^1.1.0",
			"esbuild-plugin-resolve": "^2.0.0",
			"esbuild-plugins-node-modules-polyfill": "^1.3.0",
			"estree-walker": "^2.0.2",
			"events": "^3.3.0",
			"fast-glob": "^3.3.0",
			"highlight.js": "^11.8.0",
			"lodash-es": "^4.17.21",
			"marked": "^5.1.0",
			"marked-highlight": "^2.0.1",
			"npm-dts": "^1.3.12",
			"os-browserify": "^0.3.0",
			"path-browserify": "^1.0.1",
			"prettier": "2.8.6",
			"prettier-plugin-svelte": "~2.10.0",
			"prismjs": "^1.29.0",
			"rollup-plugin-cjs": "^1.0.0",
			"sass": "^1.64.1",
			"source-map": "^0.7.4",

			"vite": "^4.3.9",
			"vite-plugin-dts": "^3.2.0",
			"vite-plugin-node-polyfills": "^0.9.0",
			"vite-plugin-require-transform": "^1.0.21",
			"vscode-css-languageservice": "~6.2.0",
			"vscode-html-languageservice": "^5.0.6",
			"vscode-languageserver": "8.0.2",
			"vscode-languageserver-protocol": "^3.17.3",
			"vscode-languageserver-textdocument": "^1.0.8",
			"vscode-languageserver-types": "3.17.2",
			"vscode-uri": "^3.0.7"
		},
		"overrides": {
			"estree-walker": "^2.0.2",
			"svelte-preprocess": {
				"typescript": "^5.1.6"
			},
			"svelte-language-server": {
				"typescript": "5.1.6"
			},
			"periscopic": {
				"estree-walker": "2.0.2"
			},
			"typescript": "^5.1.6",
			"svelte": {
				"estree-walker": "2.0.2"
			}
		},
		"imports": {},
		"exports": {
			".": {
				"import": "./dist/index.js",
				"types": "./dist/index.d.ts"
			},
			"./worker": {
				"import": "./dist/worker.js",
				"types": "./dist/worker.d.ts"
			}
		}
	}
	`,
	"file:///svelte.config.js": `
	  import preprocess from 'svelte-preprocess';
	  import adapter from '@sveltejs/adapter-auto';
	  export default {
		  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
		  // for more information about preprocessors
		  preprocess: preprocess(),
		  kit: {
			  // hydrate the <div id="svelte"> element in src/app.html
			  adapter: adapter(),
		  }
		}
`,
};

// Regular files
const files = {
	"script.ts": `
	export function add(a, b) {
		return a + b;
	}

	console.log(add(3, 5));`,
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

(async () => {
	let svelteLanguageServer = new WorkerRPC(svelteWorker, {
		rootUri: "file:///",
		documentUri: "",
		workspaceFolders: [{ name: "root", uri: "file:///" }],

		allowHTMLContent: true,
		autoClose: false,
		languageId: "svelte",
	});

	let tsLanguageServer = new WorkerRPC(tsWorker, {
		rootUri: "file:///",
		documentUri: "",
		workspaceFolders: [{ name: "root", uri: "file:///" }],

		allowHTMLContent: true,
		autoClose: false,
		languageId: "typescript",
	});

	await tsLanguageServer.fetchTypes(
		JSON.parse(init_files["file:///package.json"]),
	);
	await tsLanguageServer.setup(init_files);
	await svelteLanguageServer.fetchTypes(
		JSON.parse(init_files["file:///package.json"]),
	);
	await svelteLanguageServer.setup(init_files);
	// svelteLanguageServer.client().attachPlugin(tsLanguageServer.client());
	const states = new Map<`/${keyof typeof files}`, EditorState>();

	let code = files["App.svelte"];

	const watcher = EditorView.updateListener.of((viewUpdate) => {
		if (viewUpdate.selectionSet) {
			code = viewUpdate.state.doc.toString();
			if (currentTab === "file:///src/lib/script.ts") {
				// svelteLanguageServer.client().notify("$/onDidChangeTsOrJsFile", {
				// 	uri: "file:///src/lib/script.ts",
				// 	changes: [
				// 		{ from: 0, to: code.length, text: editor.state.doc.toString() },
				// 	],
				// });
			}
		}

		console.log({ viewUpdate, code });
	});

	const createEditorState = (uri: string) =>
		EditorState.create({
			doc: code,
			extensions: [
				basicSetup,
				watcher,
				languageServerWithTransport({
					transport: uri.endsWith(".svelte")
						? svelteLanguageServer
						: tsLanguageServer,
					documentUri: uri,
					languageId: uri.endsWith(".svelte") ? "svelte" : "typescript",
					workspaceFolders: null,
					rootUri: "file:///",
					allowHTMLContent: true,
					autoClose: false,
					client: (uri.endsWith(".svelte")
						? svelteLanguageServer
						: tsLanguageServer
					).client(),
				}),
				keymap.of(vscodeKeymap),
				oneDark,
				uri.endsWith(".ts") ? typescriptLanguage : svelte(),
				// hoverMarked,
			],
		});

	states.set("file:///App.svelte", createEditorState("file:///App.svelte"));

	// Create the editor with basic setup and Svelte language server integration
	const editor = new EditorView({
		state: states.get("file:///App.svelte"),
		parent: document.getElementById("editor")!,
		extensions: [],
	});
	let i = 0;
	button3.onclick = () => {
		let oldTab = currentTab;
		currentTab = "file:///src/lib/script.ts";

		const file = editor.state.doc.toString();
		states.set(oldTab, editor.state);

		if (!states.has("file:///src/lib/script.ts")) {
			code = files["script.ts"];
			states.set(
				"file:///src/lib/script.ts",
				createEditorState("file:///src/lib/script.ts"),
			);
		} else {
			files[oldTab.split("/").pop()!] = file;
			code = files["script.ts"];
		}
		const newState = states.get("file:///src/lib/script.ts");

		svelteLanguageServer.client().textDocumentDidOpen({
			textDocument: {
				languageId: "typescript",
				uri: "file:///src/lib/script.ts",
				version: i++,
				text: code,
			},
		});
		editor.setState(newState!);
		editor.dispatch({
			changes: { from: 0, to: editor.state.doc.length, insert: code },
		});
	};

	button1.onclick = () => {
		let oldTab = currentTab;
		currentTab = "file:///App.svelte";

		const file = editor.state.doc.toString();
		states.set(oldTab, editor.state);

		if (!states.has("file:///App.svelte")) {
			code = files["App.svelte"];
			states.set("file:///App.svelte", createEditorState("file:///App.svelte"));
		} else {
			files[oldTab.split("/").pop()!] = file;
			code = files["App.svelte"];
		}
		const newState = states.get("file:///App.svelte");

		editor.setState(newState!);
		editor.dispatch({
			changes: { from: 0, to: editor.state.doc.length, insert: code },
		});
	};

	button2.onclick = () => {
		let oldTab = currentTab;
		currentTab = "file:///src/lib/Comp1.svelte";

		const file = editor.state.doc.toString();
		states.set(oldTab, editor.state);

		if (!states.has("file:///src/lib/Comp1.svelte")) {
			code = files["Comp1.svelte"];
			states.set(
				"file:///src/lib/Comp1.svelte",
				createEditorState("file:///src/lib/Comp1.svelte"),
			);
		} else {
			files[oldTab.split("/").pop()!] = file;
			code = files["Comp1.svelte"];
		}

		files[oldTab.split("/").pop()!] = file;

		const newState = states.get("file:///src/lib/Comp1.svelte");
		editor.setState(newState!);
		editor.dispatch({
			changes: { from: 0, to: editor.state.doc.length, insert: code },
		});
	};

	// Current document to display in the editor
	code = files["App.svelte"];
})();
