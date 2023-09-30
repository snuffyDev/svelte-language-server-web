import "./prelude";
import "./global_patches";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection,
  createConnection,
} from "vscode-languageserver/browser";

import { VFS } from "./vfs";
import {
  workerRPCMethods,
  type AddFilesMessage,
  type FetchTypesMessage,
  type SetupMessage,
  type WorkerRPCMethod,
  type WorkerResponse,
  DeleteFileMessage,
} from "./messages";
import {
  PromisePool,
  fetchTypeDefinitionsFromCDN,
} from "./features/autoTypings";
import { deepMerge } from "./worker.utils";
import { handleFSSync, syncFiles } from "./features/workspace";
import { JsonValue, PackageJson } from "type-fest";
import ts from "typescript";
import path from "path";

addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

const pool = new PromisePool(10);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const originalCreateDirectory = VFS.createDirectory.bind(VFS);

VFS.createDirectory = (dirPath: string) => {
  ts.sys.createDirectory(path.posix.dirname(VFS.normalize(dirPath)));
  return originalCreateDirectory(dirPath);
};

export const BaseWorker = (
  createServer: ({ connection }: { connection: Connection }) => void,
  connection: Connection,
  name: string
) => {
  const tsConfig = {};
  const setupQueue = [];

  const isRPCMessage = (
    data: unknown
  ): data is
    | SetupMessage
    | FetchTypesMessage
    | AddFilesMessage
    | DeleteFileMessage =>
    data &&
    typeof data === "object" &&
    "method" in data &&
    workerRPCMethods.includes(data.method as never);

  try {
    console.log(`${name} Language Server running. Waiting for setup message.`);

    const handleFetchTypes = async (data: FetchTypesMessage) => {
      VFS.writeFile("/package.json", JSON.stringify(data.params));
      let ambientTypes = "";
      try {
        const json = data.params as PackageJson;
        console.log({ json });
        const devDepKeys = Object.keys(json.devDependencies || {});

        const nodeModules = VFS.readDirectory("/node_modules").map((d) =>
          d.replace("/node_modules/", "")
        );

        const node_key_length = "/node_modules/".length;
        const dependencies = Object.keys(json)
          .filter((key) => key.toLowerCase().includes("dependencies"))
          .map((key) => ({ [key]: json[key] }));

        const filteredDeps: JsonValue = {};
        for (const dependencyObject of dependencies) {
          const o = Object.keys(dependencyObject as Record<string, string>);
          console.log({ o });
          for (const key of o) {
            if (!nodeModules.some((d) => d.startsWith(key))) {
              filteredDeps[key] = dependencyObject[key];
            }
          }
        }
        console.log({ filteredDeps });
        const filteredKeys = Object.keys(filteredDeps);
        const hasSvelteKit = filteredKeys.includes("@sveltejs/kit");
        const hasVite = filteredKeys.includes("vite");

        if (hasSvelteKit) {
          ambientTypes += `import "@sveltejs/kit/types"\n`;
        }

        if (hasVite) {
          ambientTypes += `import "vite/client"\n`;
        }

        return fetchTypeDefinitionsFromCDN(filteredDeps).then((types) => {
          for (const [key, value] of types) {
            console.log({ key, value });
            const path = `/node_modules/${key}`;

            VFS.writeFile(path, value);
          }
        });
      } catch {
      } finally {
        VFS.writeFile(`/@@${Date.now()}+slsw--ambient.d.ts`, ambientTypes);
      }
    };
    addEventListener("setup-completed", (event) => {
      const id = setupQueue.shift();

      if (typeof id === "number") {
        postMessage({ id, method: "@@setup", complete: true });
      }
    });

    addEventListener("message", async (event) => {
      // Process our custom RPC messages
      if (isRPCMessage(event.data)) {
        if (event.data.method === "@@fetch-types") {
          await handleFetchTypes(event.data).catch(console.error);
          await tick();
          postMessage({
            method: "@@fetch-types",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@fetch-types">);
          return;
        }

        if (event.data.method === "@@delete-file") {
          VFS.unlink(event.data.params.fileName);

          postMessage({
            method: "@@delete-file",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@delete-file">);
          return;
        }
        await updateVFS(event.data.params);
        await tick();
        if (event.data.method === "@@setup") {
          console.log(`Setting up ${name} Language Server...`);
          setupQueue.push(event.data.id);
          await tick();
          createServer({ connection: connection });
          await tick();
          queueMicrotask(() => {
            postMessage({
              method: "@@setup",
              id: event.data.id,
              complete: true,
            } as WorkerResponse<"@@setup">);
          });
        } else {
          postMessage({
            method: "@@add-files",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@add-files">);
        }
      }
    });

    async function updateVFS(params: Record<string, string>) {
      let updateTsconfig = false;
      const fileNames = Object.keys(params).sort((a, b) => b.length - a.length);
      for (let i = 0; i < fileNames.length - 1; i++) {
        const fileName = fileNames[i];
        const fileContents = params[fileName];
        if (
          !fileName.includes("node_modules") &&
          (fileName.includes("jsconfig.json") ||
            fileName.includes("tsconfig.json"))
        ) {
          updateTsconfig = true;
          // Object.assign(
          //   tsConfig,
          //   deepMerge(
          //     tsConfig,
          //     JSON.parse(
          // fileContents.replace(
          //   /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
          //   (m, g) => (g ? "" : m)
          // )
          //     )
          //   )
          // );
        }
        const isTsOrJsConfig =
          fileName === "/tsconfig.json" || fileName === "/jsconfig.json";
        VFS.writeFile(fileName, fileContents);
        syncFiles(VFS.normalize(fileName), fileContents);
      }
    }
  } catch (e) {
    console.error({ error: e });
  }
};
