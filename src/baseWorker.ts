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
import { fetchTypeDefinitionsFromCDN } from "./features/autoTypings";
import { deepMerge } from "./worker.utils";
import { handleFSSync, syncFiles } from "./features/workspace";

addEventListener("messageerror", (e) => console.error(e));
addEventListener("error", (e) => console.error(e));

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
      try {
        return fetchTypeDefinitionsFromCDN(data.params).then((types) => {
          for (const [key, value] of types) {
            console.log({ key, value });
            VFS.writeFile(`/node_modules/${key}/index.d.ts`, value);
          }
        });
      } catch {}
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

        if (event.data.method === "@@setup") {
          console.log(`Setting up ${name} Language Server...`);
          setupQueue.push(event.data.id);
          createServer({ connection: connection });
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
      await new Promise<void>((resolve) => {
        const fileNames = Object.keys(params).sort(
          (a, b) => b.length - a.length
        );
        for (let i = 0; i < fileNames.length; i++) {
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
            //       fileContents.replace(
            //         /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
            //         (m, g) => (g ? "" : m)
            //       )
            //     )
            //   )
            // );
          }
          const isTsOrJsConfig =
            fileName === "/tsconfig.json" || fileName === "/jsconfig.json";

          Promise.resolve(VFS.writeFile(fileName, fileContents)).then(() => {
            syncFiles(VFS.normalize(fileName), fileContents);
            if (i === fileNames.length - 1) {
              resolve();
            }
          });
        }
      });
    }
  } catch (e) {
    console.error({ error: e });
  }
};
