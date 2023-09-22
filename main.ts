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
import project from "./project.json";
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
  "file:///package.json": project["/package.json"],
  "file:///tsconfig.json": project["/tsconfig.json"],
  ...Object.fromEntries(
    Object.entries(project)
      .filter(([key]) => key.includes(".svelte-kit"))
      .map(([key, value]) => [`file://${key}`, value])
  ),
};
project;

// Regular files
const files = project;

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
    languageId: "",
  });

  await svelteLanguageServer.fetchTypes(
    JSON.parse(init_files["file:///package.json"])
  );

  await tsLanguageServer.setup(init_files);
  await svelteLanguageServer.setup(init_files);
  await tsLanguageServer.addFiles(files);
  await svelteLanguageServer.addFiles(files);
  // svelteLanguageServer.client().attachPlugin(tsLanguageServer.client());
  const states = new Map<`${keyof typeof files}`, EditorState>();
  let code = files["/src/routes/+page.svelte"];

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

  states.set(
    "/src/routes/+page.svelte",
    createEditorState("/src/routes/+page.svelte")
  );

  // Create the editor with basic setup and Svelte language server integration
  const editor = new EditorView({
    state: states.get("/src/routes/+page.svelte"),
    parent: document.getElementById("editor")!,
    extensions: [],
  });
  let i = 0;

  for (const key in project) {
    const button = document.createElement("button");
    button.innerText = key.split("/").pop()!;
    nav?.appendChild(button);

    button.onclick = () => {
      let oldTab = currentTab;
      currentTab = key;

      const file = editor.state.doc.toString();
      states.set(oldTab, editor.state);

      if (!states.has(key)) {
        code = files[key];
        states.set(key, createEditorState(key));
      } else {
        files[oldTab] = file;
        code = files[key];
      }
      const newState = states.get(key);

      editor.setState(newState!);
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: code },
      });
    };
  }
  // Current document to display in the editor
  code = files["/src/routes/+page.svelte"];
})();
