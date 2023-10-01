import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { svelte } from "@replit/codemirror-lang-svelte";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import { languageServerWithTransport } from "codemirror-languageserver";
import { oneDark } from "@codemirror/theme-one-dark";

import { WorkerRPC } from "./../../../dist";
import SvelteWorker from "./main_worker?worker";
import TSWorker from "./main_ts_worker?worker";

type Files = Record<string, string>;

type InitOptions = {
  document_uri: string;
  code: string;
  files: Files;
};

const svelteWorker: Worker = new SvelteWorker();
const tsWorker: Worker = new TSWorker();

const initialStyles = {
  "background-color": "#1a1a1a",
  border: "1px solid transparent",
} as const;
const activeStyles = {
  "background-color": "#4d4d4d36",
  border: "1px solid #646cff",
} as const;

const setupLanguageServers = async (files: Files) => {
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

  await Promise.all([
    svelteLanguageServer.fetchTypes(JSON.parse(files["file:///package.json"])),
    tsLanguageServer.fetchTypes(JSON.parse(files["file:///package.json"])),
    tsLanguageServer.addFiles(files),
    svelteLanguageServer.addFiles(files),
  ]);
  await tsLanguageServer.setup(files);
  await svelteLanguageServer.setup(files);

  return { svelteLanguageServer, tsLanguageServer };
};

export const setupEditor = async (init: InitOptions) => {
  const states = new Map<string, EditorState>();

  let currentTab = init.document_uri;

  const { svelteLanguageServer, tsLanguageServer } = await setupLanguageServers(
    init.files
  );

  const createEditorState = (uri: string, code: string) => {
    return EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        ...(uri.endsWith(".svelte") ||
        uri.endsWith(".ts") ||
        uri.endsWith(".js")
          ? [
              languageServerWithTransport({
                transport: (uri.endsWith(".svelte")
                  ? svelteLanguageServer
                  : tsLanguageServer) as never,
                documentUri: uri.startsWith("file://") ? uri : `file://${uri}`,
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
            ]
          : []),
        keymap.of(vscodeKeymap),
        oneDark,
        !uri.endsWith(".svelte") ? typescriptLanguage : svelte(),
      ],
    });
  };

  // Create the editor with basic setup and Svelte language server integration
  const editor = new EditorView({
    state: createEditorState(init.document_uri, init.code),
    parent: document.getElementById("editor")!,
    extensions: [],
  });

  const setCurrentTab = (editor: EditorView, uri: string) => {
    currentTab = uri;
    if (!states.has(uri)) {
      states.set(uri, createEditorState(uri, init.files[uri]));
    }
    editor.setState(states.get(uri)!);
  };

  const setupTabs = (files: Files) => {
    const nav = document.querySelector<HTMLElement>("nav")!;

    const toggleActive = (button: HTMLButtonElement, active: boolean) => {
      if (active) {
        for (const key in activeStyles) {
          button.style.setProperty(
            key,
            activeStyles[key as keyof typeof activeStyles]
          );
        }
        button.scrollIntoView({ inline: "nearest", behavior: "smooth" });
      } else {
        for (const key in initialStyles) {
          button.style.setProperty(
            key,
            initialStyles[key as keyof typeof initialStyles]
          );
        }
      }
    };
    const findOldTabElm = () => {
      return [
        ...(nav?.querySelectorAll<HTMLButtonElement>("button") ??
          ([] as HTMLButtonElement[])),
      ].find((button) => button.innerText === currentTab)!;
    };
    let oldTabElm = findOldTabElm();

    for (const key of Object.keys(files).sort()) {
      if (key.includes(".svelte-kit") || key.includes("node_modules")) continue;
      const button = document.createElement("button");
      button.innerText = key;
      nav?.appendChild(button);

      if (key === init.document_uri) {
        toggleActive(button, true);
      }
      // states.set(key, createEditorState(key));
      button.onclick = () => {
        oldTabElm = findOldTabElm();
        if (oldTabElm) {
          toggleActive(oldTabElm, false);
        }
        currentTab = key;
        toggleActive(button, true);
        setCurrentTab(editor, key);
      };
    }
    oldTabElm = findOldTabElm();
  };

  setupTabs(init.files);

  return {
    setCurrentTab,
    svelteLanguageServer,
    tsLanguageServer,
  };
};
