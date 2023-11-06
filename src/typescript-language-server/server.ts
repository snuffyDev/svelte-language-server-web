/**
 * This TypeScript module implements a language server for providing features such as code completion,
 * diagnostics, hover information, and more for TypeScript and JavaScript files. It utilizes the
 * "vscode-languageserver/browser" protocol and integrates with the TypeScript language service.
 *
 * Overview:
 * - Imports necessary dependencies and modules for various functionalities.
 * - Defines a "Document" class to manage text documents and their content.
 * - Implements helper functions for converting TypeScript element kinds, display parts, and JSDoc tags.
 * - Entry point: "createServer" function initializes the language server's capabilities and event listeners.
 * - Language service is set up using the "createLanguageService" function with custom hosts and compiler options.
 * - Listens for initialization, open, change, completion, and hover events from the client.
 * - Performs syntax and semantic analysis to generate diagnostics for displayed issues.
 * - Integrates with the TypeScript language service for code completion, quick info, and diagnostics.
 * - Establishes connection, handles requests, and listens for events using the "vscode-languageserver/browser" library.
 */

import ts from "typescript";
import {
  CancellationToken,
  CompletionItemKind,
  CompletionList,
  DiagnosticSeverity,
  TextDocumentContentChangeEvent,
  VersionedTextDocumentIdentifier,
} from "vscode-languageserver-protocol";
import {
  Diagnostic,
  Connection,
  TextDocumentSyncKind,
  Range,
  CompletionParams,
  Position,
  HoverParams,
  Hover,
} from "vscode-languageserver/browser";

import { handleFSSync, syncFiles } from "./../features/workspace";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  readdirSync,
  // @ts-expect-error
  normalizePath,
  realpathSync,
} from "fs";
import {
  debounce,
  throttle,
  throttleAsync,
  transformHoverResultToHtml,
} from "../utils";
import { VFS } from "src/vfs";
import { getTextInRange } from "./documents/utils";
import { WritableDocument } from "./documents/WritableDocument";
import { basename, dirname, join } from "path";
import { FileType } from "vscode-html-languageservice";
import { URI } from "vscode-uri";
import { getSemanticTokenLegends } from "./lib/semanticTokenLegend";
import { debounceSameArg, debounceThrottle, filterNullishMap } from "./utils";
import EventEmitter from "events/";

export function scriptElementKindToCompletionItemKind(
  kind: ts.ScriptElementKind
): CompletionItemKind {
  switch (kind) {
    case ts.ScriptElementKind.primitiveType:
    case ts.ScriptElementKind.keyword:
      return CompletionItemKind.Keyword;
    case ts.ScriptElementKind.constElement:
      return CompletionItemKind.Constant;
    case ts.ScriptElementKind.letElement:
    case ts.ScriptElementKind.variableElement:
    case ts.ScriptElementKind.localVariableElement:
    case ts.ScriptElementKind.alias:
      return CompletionItemKind.Variable;
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.memberGetAccessorElement:
    case ts.ScriptElementKind.memberSetAccessorElement:
      return CompletionItemKind.Field;
    case ts.ScriptElementKind.functionElement:
      return CompletionItemKind.Function;
    case ts.ScriptElementKind.memberFunctionElement:
    case ts.ScriptElementKind.constructSignatureElement:
    case ts.ScriptElementKind.callSignatureElement:
    case ts.ScriptElementKind.indexSignatureElement:
      return CompletionItemKind.Method;
    case ts.ScriptElementKind.enumElement:
      return CompletionItemKind.Enum;
    case ts.ScriptElementKind.moduleElement:
    case ts.ScriptElementKind.externalModuleName:
      return CompletionItemKind.Module;
    case ts.ScriptElementKind.classElement:
    case ts.ScriptElementKind.typeElement:
      return CompletionItemKind.Class;
    case ts.ScriptElementKind.interfaceElement:
      return CompletionItemKind.Interface;
    case ts.ScriptElementKind.warning:
    case ts.ScriptElementKind.scriptElement:
      return CompletionItemKind.File;
    case ts.ScriptElementKind.directory:
      return CompletionItemKind.Folder;
    case ts.ScriptElementKind.string:
      return CompletionItemKind.Constant;
  }
  return CompletionItemKind.Property;
}

function displayPartsToString(
  displayParts: ts.SymbolDisplayPart[] | undefined
): string {
  if (displayParts) {
    return displayParts.map((displayPart) => displayPart.text).join("");
  }
  return "";
}

function tagToString(tag: ts.JSDocTagInfo): string {
  let tagLabel = `*@${tag.name}*`;
  if (tag.name === "param" && tag.text) {
    const [paramName, ...rest] = tag.text;
    tagLabel += `\`${paramName.text}\``;
    if (rest.length > 0) tagLabel += ` — ${rest.map((r) => r.text).join(" ")}`;
  } else if (Array.isArray(tag.text)) {
    tagLabel += ` — ${tag.text.map((r) => r.text).join(" ")}`;
  } else if (tag.text) {
    tagLabel += ` — ${tag.text}`;
  }
  return tagLabel;
}
function _textSpanToRange(model: TextDocument, span: ts.TextSpan): Range {
  let p1 = model.positionAt(span.start);
  let p2 = model.positionAt(span.start + span.length);
  return { start: p1, end: p2 };
}

class Document extends WritableDocument {
  constructor(
    private readonly _uri: string,
    public languageId: string,
    public version: number,
    public content: string
  ) {
    super();
  }

  public get uri(): string {
    return URI.parse(this._uri).toString(true);
  }

  public getFilePath(): string {
    return this.uri.replace("file:///", "/");
  }

  public getText(range?: Range): string {
    return range ? getTextInRange(range, this.content) : this.content;
  }

  public getURL(): string {
    return new URL(this.uri).toString();
  }

  public setText(text: string): void {
    this.content = text;
  }
}

let currentDir = "/";

const sendFileSync = debounce<(filename: string, content: string) => void>(
  (filename, content) => {
    syncFiles(filename, content);
  },
  50
);

class Cache<T> {
  protected readonly _cache: Map<string, T>;

  private getKey(fileName: string): string {
    return fileName;
  }

  public constructor(protected limit = 100) {
    this._cache = new Map<string, T>();
  }

  public tryGet(fileName: string): T | undefined {
    if (this._cache.has(this.getKey(fileName))) {
      return this._cache.get(this.getKey(fileName));
    }
    return undefined;
  }

  public set(fileName: string, data: T) {
    if (this._cache.size > this.limit) {
      this._cache.delete(this._cache.keys().next().value);
    }

    this._cache.set(this.getKey(fileName), data);

    return data;
  }
}

class CompletionCache extends Cache<CompletionList> {
  //@ts-expect-error override
  protected override getKey(fileName: string, position: Position): string {
    return `${fileName}:${position.line}:${position.character}`;
  }

  public constructor(limit = 100) {
    super(limit);
  }

  //@ts-expect-error override
  public override tryGet(
    fileName: string,
    position: Position
  ): CompletionList | undefined {
    if (this._cache.has(this.getKey(fileName, position))) {
      return this._cache.get(this.getKey(fileName, position));
    }
    return undefined;
  }

  //@ts-expect-error override
  public override set(
    fileName: string,
    position: Position,
    list: CompletionList
  ) {
    if (this._cache.size > this.limit) {
      this._cache.delete(this._cache.keys().next().value);
    }

    this._cache.set(this.getKey(fileName, position), list);

    return list;
  }
}

const completionCache = new CompletionCache();

class DiagnosticsManager {
  public constructor(
    private sendDiagnostics: (params: {
      uri: string;
      diagnostics: Diagnostic[];
    }) => void,
    private docManager: DocumentManager,
    private getDiagnostics: (doc: Document) => Diagnostic[]
  ) {}

  private pendingUpdates = new Set<Document>();

  private updateAll() {
    this.docManager.getDocuments().forEach((doc) => {
      this.update(doc);
    });
    this.pendingUpdates.clear();
  }

  scheduleUpdateAll = debounceThrottle(() => this.updateAll(), 1000);

  private async update(document: Document) {
    const diagnostics = await this.getDiagnostics(document);
    this.sendDiagnostics({
      uri: document.uri,
      diagnostics,
    });
  }

  removeDiagnostics(document: Document) {
    this.pendingUpdates.delete(document);
    this.sendDiagnostics({
      uri: document.uri,
      diagnostics: [] as Diagnostic[],
    });
  }

  scheduleUpdate(document: Document) {
    if (!this.docManager.getDocument(document.getURL())) {
      return;
    }

    this.pendingUpdates.add(document);
    this.scheduleBatchUpdate();
  }

  private scheduleBatchUpdate = debounceThrottle(() => {
    this.pendingUpdates.forEach((doc) => {
      this.update(doc);
    });
  }, 1000);
}

const JS_TS_EXTS = [
  ".ts",
  ".d.ts",
  ".js",
  ".mjs",
  ".jsx",
  ".tsx",
  ".cjs",
  ".mts",
  ".cts",
] as const;

const docManagerEvents = [
  "documentChange",
  "documentClose",
  "documentOpen",
] as const;
type DocumentManagerEvents = (typeof docManagerEvents)[number];

class DocumentManager {
  private emitter = new EventEmitter.EventEmitter();
  private readonly documents = new Map<string, Document>();
  private cancellableEmit = debounceSameArg(
    (document: Document) => {
      this.emitter.emit("documentChange", document);
    },
    (a, b) => a?.uri === b?.uri,
    1000
  );

  public getDocument(uri: string): Document | undefined {
    return this.documents.get(uri);
  }

  public getDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  public updateDocument(
    textDocument: VersionedTextDocumentIdentifier,
    changes: TextDocumentContentChangeEvent[]
  ) {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      throw new Error("Cannot call methods on an unopened document");
    }

    for (const change of changes) {
      let start = 0;
      let end = 0;
      if ("range" in change) {
        start = document.offsetAt(change.range.start);
        end = document.offsetAt(change.range.end);
      } else {
        end = document.getTextLength();
      }

      document.update(change.text, start, end);
    }
  }
  public openDocument(
    uri: string,
    languageId: string,
    version: number,
    content: string
  ): Document {
    const document = new Document(uri, languageId, version, content);
    this.documents.set(uri, document);
    this.emitter.emit("documentOpen", document);
    return document;
  }

  public scheduleUpdate(document: Document) {
    this.cancellableEmit(document);
  }

  public closeDocument(uri: string): void {
    const document = this.documents.get(uri);
    if (document) {
      this.documents.delete(uri);
      this.emitter.emit("documentClose", document);
    }
  }

  public on(
    event: DocumentManagerEvents,
    listener: (document: Document) => void
  ) {
    return this.emitter.on(event, listener);
  }

  public off(
    event: DocumentManagerEvents,
    listener: (document: Document) => void
  ) {
    return this.emitter.off(event, listener);
  }
}

export const createServer = ({ connection }: { connection: Connection }) => {
  const docs: Record<string, WritableDocument> = {};

  const docManager = new DocumentManager();
  const diagnosticsManager = new DiagnosticsManager(
    (params) => {
      connection.sendDiagnostics(params);
    },
    docManager,
    (doc) => {
      return lintSystem(doc);
    }
  );

  docManager.on(
    "documentChange",
    diagnosticsManager.scheduleUpdate.bind(diagnosticsManager)
  );
  docManager.on(
    "documentClose",
    diagnosticsManager.removeDiagnostics.bind(diagnosticsManager)
  );
  docManager.on(
    "documentOpen",
    diagnosticsManager.scheduleUpdate.bind(diagnosticsManager)
  );

  const createLanguageService = () => {
    var fileVersions = new Map();

    let projectVersion = 0;

    const getCompilerOptions = () => {
      return ts.parseJsonConfigFileContent(
        ts.readConfigFile("/tsconfig.json", ts.sys.readFile).config,
        ts.sys,
        "/",
        {
          allowJs: true,
          checkJs: true,
          baseUrl: ".",
          allowNonTsExtensions: true,
          target: ts.ScriptTarget.Latest,
          noEmit: true,
          declaration: false,
          skipLibCheck: true,
        },
        "/tsconfig.json"
      );
    };

    const compilerOptions: ts.CompilerOptions = {
      ...getCompilerOptions().options,

      allowJs: true,
      checkJs: true,
      baseUrl: ".",
      allowNonTsExtensions: true,
      target: ts.ScriptTarget.Latest,
      noEmit: true,
      declaration: false,
      skipLibCheck: true,
    };

    const compilerHost = ts.createCompilerHost(compilerOptions);
    const resolutionCache = ts.createModuleResolutionCache(
      "/",
      compilerHost.getCanonicalFileName,
      compilerOptions
    );

    const projectFileSnapshots = new Map<string, ts.IScriptSnapshot>();

    const getScriptSnapshot = (fileName: string) => {
      if (!projectFileSnapshots.has(fileName)) {
        const contents = VFS.readFile(fileName, "utf-8");
        if (contents) {
          projectFileSnapshots.set(
            fileName,
            ts.ScriptSnapshot.fromString(contents.toString())
          );
        }
      }

      return projectFileSnapshots.get(fileName);
    };

    // const originalEmit = compilerHost(compilerHost);
    const host: ts.LanguageServiceHost = {
      log: (message) => console.debug(`[ts] ${message}`),
      getCompilationSettings: () => getCompilerOptions().options,
      getScriptFileNames() {
        return VFS.readDirectory("/", JS_TS_EXTS, ["node_modules"]);
      },

      writeFile: (filename, content) => {
        ts.sys.writeFile(filename, content, false);
        VFS.writeFile(filename, content);
      },
      realpath: realpathSync,
      getScriptVersion: function getScriptVersion(fileName) {
        return fileVersions.get(fileName) || "0";
      },

      getScriptSnapshot,
      getCurrentDirectory() {
        return "/";
      },
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      fileExists: VFS.fileExists.bind(VFS),
      readFile: (path, encoding) => VFS.readFile(path, encoding).toString(),
      readDirectory(
        path: string,
        extensions?: readonly string[],
        excludes?: readonly string[],
        includes?: readonly string[],
        depth?: number
      ): string[] {
        console.log({ path, extensions, excludes, includes, depth });
        return ts.sys.readDirectory(
          path,
          extensions,
          excludes,
          includes,
          depth
        );
      },
      getDirectories: (...args) => {
        return VFS.getDirectories(...args);
      },
      useCaseSensitiveFileNames: () => false,
      getScriptKind: function getSnapshot(fileName: string) {
        const ext = fileName.split(".").pop();
        switch (ext.toLowerCase()) {
          case ts.Extension.Js:
            return ts.ScriptKind.JS;
          case ts.Extension.Jsx:
            return ts.ScriptKind.JSX;
          case ts.Extension.Ts:
            return ts.ScriptKind.TS;
          case ts.Extension.Tsx:
            return ts.ScriptKind.TSX;
          case ts.Extension.Json:
            return ts.ScriptKind.JSON;
          default:
            return ts.ScriptKind.Unknown;
        }
      },
      getProjectVersion: () => projectVersion.toString(),
      getNewLine: () => ts.sys.newLine,
    };

    let languageService = ts.createLanguageService(host);
    type LanguageServiceWithFileMethods = ts.LanguageService & {
      updateFile: (fileName: string, content: string) => void;
      createFile: (fileName: string, content: string) => void;
    };
    const mod: LanguageServiceWithFileMethods = {
      ...languageService,
      updateFile: function (
        this: LanguageServiceWithFileMethods,
        fileName: string,
        content: string
      ) {
        fileVersions.set(fileName, (fileVersions.get(fileName) || 0) + 1);
        if (projectFileSnapshots.has(fileName)) {
          projectFileSnapshots.delete(fileName);
        }

        VFS.writeFile(fileName, content);
        ts.sys.writeFile(fileName, content, false);

        projectVersion++;
      },
      createFile: function (
        this: LanguageServiceWithFileMethods,
        fileName: string,
        content: string
      ) {
        sendFileSync(fileName, content);

        return this.updateFile(fileName, content);
      },
    };

    return mod;
  };

  let env = createLanguageService();
  handleFSSync((name, contents) => {
    if (JS_TS_EXTS.some((ext) => name.endsWith(ext))) {
      env.updateFile(normalizePath(name), contents);
    } else {
      VFS.writeFile(name, contents);
    }
  });
  globalThis.localStorage = globalThis.localStorage ?? ({} as Storage);

  connection.onInitialize(() => {
    return {
      capabilities: {
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Full,
          save: {
            includeText: false,
          },
        },
        completionProvider: {
          completionItem: { labelDetailsSupport: true },
          triggerCharacters: [
            ".",
            '"',
            "'",
            "`",
            "/",
            "@",
            "<",

            // Emmet
            ">",
            "*",
            "#",
            "$",
            "+",
            "^",
            "(",
            "[",
            "@",
            "-",
            // No whitespace because
            // it makes for weird/too many completions
            // of other completion providers

            // Svelte
            ":",
            "|",
          ],
        },
        signatureHelpProvider: {
          triggerCharacters: ["(", ",", "<"],
          retriggerCharacters: [")"],
        },
        semanticTokensProvider: {
          legend: getSemanticTokenLegends(),
          range: true,
          full: true,
        },
        referencesProvider: true,
        selectionRangeProvider: true,
        hoverProvider: true,
      },
    };
  });
  function updateFile(filePath: string, content: string) {
    env.updateFile(filePath, content);
  }

  async function autocompleteAtPosition(
    pos: number,
    filePath: string,
    params: CompletionParams,
    cancellationToken: CancellationToken
  ): Promise<CompletionList> {
    const dispose = cancellationToken.onCancellationRequested(() => {
      throw null;
    });
    try {
      const result = env.getCompletionsAtPosition(filePath, pos, {
        includePackageJsonAutoImports: "on",
        includeCompletionsForImportStatements: true,
        includeCompletionsForModuleExports: true,
        triggerKind: params.context.triggerKind,
        includeCompletionsWithInsertText: true,
        triggerCharacter: params.context
          .triggerCharacter as ts.CompletionsTriggerCharacter,
        useLabelDetailsInCompletionEntries: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsWithSnippetText: true,
        includeCompletionsWithClassMemberSnippets: true,
        includeCompletionsWithObjectLiteralMethodSnippets: true,
      });
      if (!result || cancellationToken.isCancellationRequested) {
        return null;
      }

      const list = {
        items: filterNullishMap(result.entries, (entry) => {
          if (!entry) return null;
          return {
            ...entry,
            label: entry.name,
            kind: scriptElementKindToCompletionItemKind(entry.kind),
          };
        }),
        isIncomplete: result.isIncomplete,
      };

      return list;
    } catch (error) {
      return null;
    } finally {
      dispose.dispose();
    }
  }

  function infoAtPosition(pos: number, filePath: string) {
    const result = env.getQuickInfoAtPosition(filePath, pos);

    return result;
  }

  const lintSystem = (doc: Document) => {
    if (!env) return;

    const filePath = doc.getFilePath();
    const SyntacticDiagnostics = env.getSyntacticDiagnostics(filePath);
    const SemanticDiagnostic = env.getSemanticDiagnostics(filePath);
    const SuggestionDiagnostics = env.getSuggestionDiagnostics(filePath);

    type ErrorMessageObj = {
      messageText: string;
      next?: ErrorMessageObj[];
    };
    type ErrorMessage = ErrorMessageObj | string;

    const messagesErrors = (message: ErrorMessage): string[] => {
      if (typeof message === "string") return [message];

      const messageList: string[] = [];
      const getMessage = (loop: ErrorMessageObj) => {
        messageList.push(loop.messageText);

        if (loop.next) {
          loop.next.forEach((item) => {
            getMessage(item);
          });
        }
      };

      getMessage(message);

      return messageList;
    };
    const diagnostics: Diagnostic[] = ([] as ts.DiagnosticWithLocation[])
      .concat(SyntacticDiagnostics, SemanticDiagnostic, SuggestionDiagnostics)
      .reduce((acc, result) => {
        const severity: Diagnostic["severity"][] = [
          DiagnosticSeverity.Warning,
          DiagnosticSeverity.Error,
          DiagnosticSeverity.Information,
          DiagnosticSeverity.Hint,
        ];

        const messages = messagesErrors(result.messageText);
        for (const message of messages) {
          acc.push({
            range: _textSpanToRange(doc, result),
            message,
            source: result?.source || "ts",
            severity: severity[result.category],
          });
        }

        return acc;
      }, [] as Diagnostic[]);

    return diagnostics;
  };

  connection.onDidOpenTextDocument((params) => {
    const filePath = normalizePath(params.textDocument.uri);
    const content = params.textDocument.text;
    const doc = docManager.openDocument(
      params.textDocument.uri,
      params.textDocument.languageId,
      params.textDocument.version,
      content
    );

    currentDir = dirname(filePath);
    env.createFile(filePath, content);
    docManager.scheduleUpdate(doc);
  });

  connection.onDidChangeTextDocument(async (params) => {
    const filePath = normalizePath(params.textDocument.uri);
    const content = params.contentChanges[0].text;
    const doc = docManager.getDocument(params.textDocument.uri);

    docManager.updateDocument(params.textDocument, params.contentChanges);

    if (currentDir !== dirname(filePath)) {
      currentDir = dirname(filePath);
    }
    env.createFile(filePath, content);
    docManager.scheduleUpdate(doc);
  });

  connection.onCompletion(async (params, cancellationToken) => {
    const filePath = normalizePath(params.textDocument.uri);
    const doc = docManager.getDocument(params.textDocument.uri);
    return autocompleteAtPosition(
      doc.offsetAt(params.position),
      filePath,
      params,
      cancellationToken
    );
  });

  const onHover = debounce<(params: HoverParams) => Hover>((params) => {
    const { textDocument, position } = params;
    const filePath = normalizePath(textDocument.uri);
    const sourceDoc = docManager.getDocument(textDocument.uri);

    const info = infoAtPosition(sourceDoc.offsetAt(position), filePath);

    if (!info) {
      return;
    }

    const documentation = displayPartsToString(info.documentation);
    const tags = info.tags
      ? info.tags.map((tag) => tagToString(tag)).join("  \n\n")
      : "";
    const contents = displayPartsToString(info.displayParts);
    return transformHoverResultToHtml({
      range: _textSpanToRange(sourceDoc, info.textSpan),
      contents: [
        {
          language: "typescript",
          value: "```typescript\n" + contents + "\n```\n",
        },
        {
          language: "typescript",

          value: documentation + (tags ? "\n\n" + tags : ""),
        },
      ],
    });
  }, 32);

  connection.onHover(onHover);

  connection.listen();

  return () => {
    connection.dispose();
  };
};
