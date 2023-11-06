import { Connection } from "vscode-languageserver/browser";
import "./global_patches";
import "./prelude";
import { JsonValue, PackageJson } from "type-fest";
import { fetchTypeDefinitionsFromCDN } from "./features/autoTypings";
import { syncFiles } from "./features/workspace";
import {
  DeleteFileMessage,
  workerRPCMethods,
  type AddFilesMessage,
  type FetchTypesMessage,
  type SetupMessage,
  type WorkerResponse,
} from "./messages";
import { VFS } from "./vfs";

import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from "vscode-languageserver/browser";

addEventListener("messageerror", (e) => console.debug(Error(`${e}`)));
addEventListener("error", (e) => console.debug(Error(`${e}`)));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let server: () => void;

export const BaseWorker = (
  createServer: ({ connection }: { connection: Connection }) => () => void,
  connection: Connection,
  name: string
) => {
  const setupQueue = [];
  let port: MessagePort;

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

  const handleRestartLS = async ({ textDocument: { uri: fileName } }) => {
    console.log({ fileName });
    console.log(`Restarting ${name} Language Server...`);
    if (
      server &&
      fileName.includes("node_modules") === false &&
      (fileName.includes("package.json") ||
        fileName.includes("tsconfig.json") ||
        fileName.includes("jsconfig.json"))
    ) {
      server();

      connection = createConnection(
        new BrowserMessageReader(
          globalThis as unknown as DedicatedWorkerGlobalScope
        ),
        new BrowserMessageWriter(
          globalThis as unknown as DedicatedWorkerGlobalScope
        )
      );

      connection.onDidChangeTextDocument(handleRestartLS);

      server = createServer({ connection: connection });
    }
  };

  const originalOnDidChangeTextDocument =
    connection.onDidChangeTextDocument.bind(connection);

  connection.onDidChangeTextDocument = (handler) => {
    const wrappedHandler: (...params: Parameters<typeof handler>) => void = (
      ...params
    ) => {
      handler(...params);
      handleRestartLS(...params);
    };
    return originalOnDidChangeTextDocument(wrappedHandler);
  };
  try {
    console.log(`${name} Language Server running. Waiting for setup message.`);

    const handleFetchTypes = async (data: FetchTypesMessage) => {
      VFS.writeFile("/package.json", JSON.stringify(data.params));
      let ambientTypes = "";
      try {
        const json = data.params as PackageJson;

        const nodeModules = VFS.readDirectory("/node_modules").map((d) =>
          d.replace("/node_modules/", "")
        );

        // Get each `*Dependencies` key from the package.json
        const dependencies = Object.keys(json)
          .filter((key) => key.toLowerCase().includes("dependencies"))
          .map((key) => ({ [key]: json[key] }));

        const packagesToInstall: JsonValue = {};

        // Filter out the node_modules that already exist
        for (const dependencyObject of dependencies) {
          const o = Object.keys(dependencyObject as Record<string, string>);
          for (const key of o) {
            if (!nodeModules.some((d) => d.startsWith(key))) {
              packagesToInstall[key] = dependencyObject[key];
            }
          }
        }

        const packageKeys = Object.keys(packagesToInstall);
        const hasSvelteKit = packageKeys.includes("@sveltejs/kit");
        const hasVite = packageKeys.includes("vite");

        if (hasSvelteKit) {
          ambientTypes += `import "@sveltejs/kit/types"\n`;
        }

        if (hasVite) {
          ambientTypes += `import "vite/client"\n`;
        }

        return fetchTypeDefinitionsFromCDN(packagesToInstall).then((types) => {
          for (const [key, value] of types) {
            const path = `/node_modules/${key}`;

            VFS.writeFile(path, value);
            syncFiles(path, value);
          }
        });
      } catch {
      } finally {
        const ambientTypesPath = `/node_modules/@types/@@${Date.now()}+slsw--ambient.d.ts`;
        VFS.writeFile(ambientTypesPath, ambientTypes);
        syncFiles(ambientTypesPath, ambientTypes);
      }
    };
    addEventListener("setup-completed", (event) => {
      const id = setupQueue.shift();

      if (typeof id === "number") {
        postMessage({ id, method: "@@setup", complete: true });
      }
    });

    const onMessage = async (event: MessageEvent<any>) => {
      if (event.ports.length) {
        port = event.ports[0];
        port.onmessage = onMessage;
        return;
      }

      // Process our custom RPC messages
      if (isRPCMessage(event.data)) {
        if (event.data.method === "@@fetch-types") {
          await handleFetchTypes(event.data).catch(console.error);
          await sleep(100);
          port.postMessage({
            method: "@@fetch-types",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@fetch-types">);
          return;
        }

        if (event.data.method === "@@delete-file") {
          VFS.unlink(event.data.params.fileName);

          port.postMessage({
            method: "@@delete-file",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@delete-file">);
          return;
        }

        updateVFS(event.data.params);

        if (event.data.method === "@@setup") {
          console.log(`Setting up ${name} Language Server...`);
          server = createServer({ connection: connection });
          await sleep(100);
          port.postMessage({
            method: "@@setup",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@setup">);
        } else {
          await sleep(100);
          port.postMessage({
            method: "@@add-files",
            id: event.data.id,
            complete: true,
          } as WorkerResponse<"@@add-files">);
        }
      }
    };
    addEventListener("message", onMessage);

    function updateVFS(params: Record<string, string>) {
      const fileNames = Object.keys(params).sort((a, b) => b.length - a.length);
      let willRestart = false;

      for (let i = 0; i < fileNames.length - 1; i++) {
        const fileName = fileNames[i];
        const fileContents = params[fileName];

        VFS.writeFile(fileName, fileContents);
        syncFiles(VFS.normalize(fileName), fileContents);

        if (
          fileName.includes("node_modules") === false &&
          (fileName.includes("package.json") ||
            fileName.includes("tsconfig.json") ||
            fileName.includes("jsconfig.json"))
        ) {
          willRestart = true;
        }
      }
    }
  } catch (e) {
    console.error({ error: e });
  }
};
