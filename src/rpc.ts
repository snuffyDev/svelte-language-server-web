import type { Transport } from "@open-rpc/client-js/build/transports/Transport";
import { JSONRPCError } from "@open-rpc/client-js/src/Error";
import {
  IJSONRPCNotification,
  IJSONRPCNotificationResponse,
  IJSONRPCResponse,
  JSONRPCRequestData,
} from "@open-rpc/client-js/src/Request";
import { LanguageServerClient } from "codemirror-languageserver/";
import type { PackageJson } from "type-fest";
import { WorkspaceFolder } from "vscode-languageserver-types";
import { WorkerMessage, WorkerRPCMethod, WorkerResponse } from "./messages";
import PostMessageWorkerTransport from "./transport";

interface LanguageServerBaseOptions {
  rootUri: string | null;
  workspaceFolders: WorkspaceFolder[] | null;
  documentUri: string;
  languageId: string;
}
interface LanguageServerClientOptions extends LanguageServerBaseOptions {
  transport: Transport | WorkerRPC;
  autoClose?: boolean;
}
interface LanguageServerOptions extends LanguageServerClientOptions {
  client?: LanguageServerClient;
  allowHTMLContent?: boolean;
}

interface ITransportEvents {
  error: (data: JSONRPCError) => void;
  notification: (data: IJSONRPCNotificationResponse) => void;
  pending: (data: JSONRPCRequestData) => void;
  response: (data: IJSONRPCResponse) => void;
}

type FileName = string;
type FileContents = string;
type Files = Record<FileName, FileContents>;

/**
 * A class that wraps the Worker and provides a simple RPC interface.
 *
 * @example
 *
 * ```ts
 * const svelteRpc = new WorkerRPC("/path/to/worker.js", {
 * 	languageId: "svelte",
 * 	rootUri: "/",
 * });
 *
 * worker.fetchTypes("
 * worker.addFiles({
 * 	"App.svelte": `<script>let foo = "bar";</script><p>{foo}</p>`,
 * });
 *
 * worker.fetchTypes("App.svelte").then((success) => {
 * 	if (success) {
 * 		const client = worker.client();
 * 		const diagnostics = client.getDiagnostics("App.svelte");
 * 		console.log(diagnostics);
 * 	}
 * });
 * ```
 */
// @ts-expect-error
export class WorkerRPC extends PostMessageWorkerTransport {
  private internalMessageId = 0;
  private rpcQueue: Map<number, (value: boolean) => void> = new Map();
  private langClient!: LanguageServerClient;
  private worker!: Worker;
  private port!: MessagePort;

  /**
   * Creates the language Worker from the provided URL.
   * @param worker The URL to the worker file.
   * @param options The options to pass to the Language Client.
   */
  constructor(worker: URL, options: Omit<LanguageServerOptions, "transport">);
  /**
   *  Uses a pre-existing instance of the Worker
   * @param worker The instantiated Worker.
   * @param options The options to pass to the Language Client.
   *
   */
  constructor(
    worker: Worker,
    options: Omit<LanguageServerOptions, "transport">
  );
  /**
   *  Creates the language Worker from the provided string.
   *  When using a string, it is assumed that it is an absolute path to the worker file.
   * @param worker The path to the worker file.
   * @param options The options to pass to the Language Client.
   */
  constructor(
    worker: string,
    options: Omit<LanguageServerOptions, "transport"> & {
      transport: WorkerRPC;
    }
  );
  constructor(
    worker: string | Worker | URL,
    private options:
      | LanguageServerOptions
      | Omit<LanguageServerOptions, "transport">
  ) {
    let _worker: Worker;
    const { port1: sender, port2: workerPort } = new MessageChannel();

    switch (typeof worker) {
      case "string":
        _worker = new Worker(worker);
        break;
      default: {
        if (worker instanceof Worker) {
          _worker = worker;
          break;
        }
        if (worker instanceof URL) {
          _worker = new Worker(worker);
          break;
        }

        throw new Error(
          `Invalid worker type. Expected string, URL, or Worker. Received ${typeof worker}`
        );
      }
    }
    _worker.postMessage({ port: workerPort }, [workerPort]);

    super(_worker);

    this.port = sender;
    this.port.onmessage = (e) => {
      this.onMessage(e);
    };
    this.port.start();

    this.worker.onerror = (e) => {
      console.error(e);
    };

    this.worker.onmessageerror = (e) => {
      console.error(e);
    };
  }

  public client =
    (): import("codemirror-languageserver").LanguageServerClient => {
      if (!this.langClient) {
        this.langClient = new LanguageServerClient({
          // @ts-expect-error it's fine
          transport: this as unknown as Transport,
          ...this.options,
        });
      }

      return this.langClient;
    };

  dispose() {
    this.worker.removeEventListener("message", this.onMessage);
    this.port.onmessage = null;
    this.worker.terminate();

    this.rpcQueue.clear();
    this.langClient.close();
  }

  sendNotification(method: string, params: object | any[]) {
    (this.langClient as any).notify(method, params);
  }

  /**
   * Sends an object containing files to add to the Worker.
   *
   * @param files - An object containing the files to add.
   */
  public addFiles(files: Files): Promise<boolean>;
  /**
   * Sends a single file to add to the Worker.
   *
   * @param name - The name of the file.
   * @param content - The contents of the file.
   */
  public addFiles(name: string, content: string): Promise<boolean>;
  public addFiles(
    filesOrName: unknown,
    content?: string | undefined
  ): Promise<boolean> {
    if (typeof filesOrName === "object") {
      return this.sendAddFiles(filesOrName as Record<string, string>);
    }
    if (typeof filesOrName === "string" && typeof content === "string") {
      return this.sendAddFiles({ [filesOrName]: content });
    }
    throw new Error("Invalid arguments");
  }

  /**
   * Sends a request to the Worker to fetch the types for the provided files.
   *
   * @param packageJson - An object representing the package.json file.
   * @returns A promise that resolves when the Worker has finished fetching the types.
   * The promise resolves to a boolean indicating whether the fetch was successful.
   */
  public fetchTypes(pkgJson: PackageJson): Promise<boolean> {
    return this.sendFetchTypes(pkgJson);
    throw new Error("Invalid arguments");
  }

  /**
   * Sends a request to the Worker to fetch the types for the provided files.
   *
   * @param files - An object containing the files to fetch types for.
   * @returns A promise that resolves when the Worker has finished fetching the types.
   * The promise resolves to a boolean indicating whether the fetch was successful.
   */
  public setup(configFiles: Files): Promise<LanguageServerClient>;
  public setup(
    configFile: string,
    configContents: string
  ): Promise<LanguageServerClient>;
  public setup(
    configFilesOrName: unknown,
    configContents?: string | undefined
  ): Promise<LanguageServerClient> {
    if (typeof configFilesOrName === "object") {
      return this.sendSetup(configFilesOrName as Record<string, string>);
    }
    if (
      typeof configFilesOrName === "string" &&
      typeof configContents === "string"
    ) {
      return this.sendSetup({ [configFilesOrName]: configContents });
    }
    throw new Error("Invalid arguments");
  }

  /**
   * Sends a request to the Worker to delete the provided file matching the given file name.
   *
   * @param fileName - The name of the file to delete.
   * @returns A promise that resolves when the Worker has finished deleting the file.
   */
  public deleteFile(fileName: string) {
    return this.sendDeleteFile(fileName);
  }

  private sendDeleteFile(fileName: string) {
    return new Promise<boolean>((resolve, reject) => {
      const id = this.internalMessageId++;
      this.rpcQueue.set(id, resolve);
      this.port.postMessage({
        id,
        method: "@@delete-file",
        params: { fileName },
      } as WorkerMessage<"@@delete-file">);
    });
  }

  private onMessage(e: MessageEvent) {
    const data = e.data as
      | IJSONRPCResponse
      | IJSONRPCNotification
      | WorkerResponse<WorkerRPCMethod>;

    if (data && typeof data === "object" && "jsonrpc" in data) {
      return;
    }

    if (
      data &&
      typeof data === "object" &&
      "method" in data &&
      "complete" in data
    ) {
      const method = data.method as WorkerRPCMethod;
      switch (method) {
        case "@@setup":
        case "@@add-files":
        case "@@fetch-types":
          this.rpcQueue.get(data.id)?.(data.complete as boolean);
          this.rpcQueue.delete(data.id);
          return;
        default:
          throw new Error(`Unknown RPC method ${method}`);
      }
    }
  }

  private sendAddFiles(files: Files) {
    const promise = new Promise<boolean>((resolve, reject) => {
      const id = this.internalMessageId++;
      this.rpcQueue.set(id, resolve);
      this.port.postMessage({
        params: files,
        id,
        method: "@@add-files",
      } as WorkerMessage<"@@add-files">);
    });
    return promise;
  }

  private sendFetchTypes(files: PackageJson) {
    return new Promise<boolean>((resolve, reject) => {
      const id = this.internalMessageId++;
      this.rpcQueue.set(id, resolve);
      this.port.postMessage({
        id,
        method: "@@fetch-types",
        params: files,
      } as WorkerMessage<WorkerRPCMethod>);
    });
  }

  private async sendSetup(configFiles: Files) {
    const promise = new Promise<boolean>((resolve, reject) => {
      const id = this.internalMessageId++;
      this.rpcQueue.set(id, resolve);
      this.port.postMessage({
        params: configFiles,
        id,
        method: "@@setup",
      } as WorkerMessage<"@@setup">);
    });

    return promise.then((r) => {
      return this.client();
    });
  }
}
