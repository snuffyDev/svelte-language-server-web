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
  CompletionItemKind,
  CompletionList,
  DiagnosticSeverity,
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
import { debounceSameArg, debounceThrottle } from "./utils";

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

const matchFiles: (
  path: string,
  extensions: readonly string[] | undefined,
  excludes: readonly string[] | undefined,
  includes: readonly string[] | undefined,
  useCaseSensitiveFileNames: boolean,
  currentDirectory: string,
  depth: number | undefined,
  getFileSystemEntries: (path: string) => {
    files: readonly string[];
    directories: readonly string[];
  },
  realpath: (path: string) => string
) => string[] = (ts as any).matchFiles;

// from: https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/web/webServer.ts#L491
function getAccessibleFileSystemEntries(path: string): {
  files: readonly string[];
  directories: readonly string[];
} {
  const uri = path;
  let entries: [string, FileType][] = [];
  const files: string[] = [];
  const directories: string[] = [];
  try {
    entries = VFS.readDirectoryRaw(uri);
  } catch (_e) {
    try {
      entries = VFS.readDirectoryRaw(
        URI.file(join(uri, "node-modules")).toString()
      );
    } catch (_e) {}
  }
  for (const [entry, type] of entries) {
    // This is necessary because on some file system node fails to exclude
    // '.' and '..'. See https://github.com/nodejs/node/issues/4002
    if (entry === "." || entry === "..") {
      continue;
    }

    if (type === FileType.File) {
      files.push(entry);
    } else if (type === FileType.Directory) {
      directories.push(entry);
    }
  }
  files.sort();
  directories.sort();
  return { files, directories };
}

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

export const createServer = ({ connection }: { connection: Connection }) => {
  const docs: Record<string, WritableDocument> = {};

  const createLanguageService = () => {
    var fileVersions = new Map();

    let projectVersion = 0;

    function getScriptSnapshot(fileName) {
      var contents = VFS.readFile(fileName, "utf-8");

      if (contents) {
        return ts.ScriptSnapshot.fromString(contents.toString());
      }

      return;
    }

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

    const scriptFileNameCache = () => {
      const __cache = new Cache<string[]>(10);
      const getScriptFileNames = () => {};
    };
    // const originalEmit = compilerHost(compilerHost);
    const host: ts.LanguageServiceHost = {
      log: (message) => console.debug(`[ts] ${message}`),
      getCompilationSettings: () => getCompilerOptions().options,
      getScriptFileNames() {
        return Array.from(readdirSync("/")).filter(
          (key) =>
            !key.includes("/node_modules/") &&
            (key.endsWith(".ts") ||
              key.endsWith(".tsx") ||
              key.endsWith(".js") ||
              key.endsWith(".jsx") ||
              key.endsWith(".js"))
        );
      },
      getCompilerHost() {
        return compilerHost;
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
        return currentDir;
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
        return compilerHost.readDirectory(
          path,
          extensions,
          excludes,
          includes,
          depth
        );
      },
      getDirectories: (...args) => {
        return VFS.getDirectories(...args).filter(
          (v) => !v.includes("/node_modules/")
        );
      },
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
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
      resolveModuleNameLiterals: compilerHost.resolveModuleNameLiterals,

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
        return this.createFile(fileName, content);
      },
      createFile: function (
        this: LanguageServiceWithFileMethods,
        fileName: string,
        content: string
      ) {
        fileVersions.set(fileName, (fileVersions.get(fileName) || 0) + 1);
        VFS.writeFile(fileName, content);
        ts.sys.writeFile(fileName, content, false);
        projectVersion++;
        sendFileSync(fileName, content);
      },
    };

    return mod;
  };

  let env = createLanguageService();
  handleFSSync((name, contents) => {
    if (name.endsWith(".ts") || name.endsWith(".js")) {
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
          change: TextDocumentSyncKind.Incremental,
          save: {
            includeText: false,
          },
        },
        completionProvider: {
          completionItem: { labelDetailsSupport: true },
          workDoneProgress: true,
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

  // await createTsSystem({}, "", new Map<string, string>([]));
  function updateFile(filePath: string, content: string) {
    env.updateFile(filePath, content);
  }

  function autocompleteAtPosition(
    pos: number,
    filePath: string,
    params: CompletionParams
  ): CompletionList {
    const result = env.getCompletionsAtPosition(filePath, pos, {
      includeCompletionsForImportStatements: true,
      includeCompletionsForModuleExports: true,
      triggerKind: params.context.triggerKind,
      includeCompletionsWithInsertText: true,
      triggerCharacter: params.context.triggerCharacter as ts.CompletionsTriggerCharacter,
      useLabelDetailsInCompletionEntries: true,
      allowIncompleteCompletions: false,
      includeAutomaticOptionalChainCompletions: true,
      includeCompletionsWithSnippetText: true,
      includeCompletionsWithClassMemberSnippets: true,
      includeCompletionsWithObjectLiteralMethodSnippets: true,
    });
    const list = {
      items: result.entries
        .filter((v) => v !== null && v !== undefined)
        .map((entry) => {
          return {
            ...entry,
            label: entry.name,
            kind: scriptElementKindToCompletionItemKind(entry.kind),
          };
        }),
      isIncomplete: result.isIncomplete,
    };

    return list;
  }

  function infoAtPosition(pos: number, filePath: string) {
    const result = env.getQuickInfoAtPosition(filePath, pos);

    return result;
  }

  const lintSystem = (() => {
    const _lint = debounceThrottle<string>((filePath) => {
      if (!env) return;

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
              range: _textSpanToRange(docs[`${filePath}`], result),
              message,
              source: result?.source || "ts",
              severity: severity[result.category],
              // actions: codeActions as any as Diagnostic["actions"]
            });
          }

          return acc;
        }, [] as Diagnostic[]);

      // return { items: diagnostics };
      connection.sendDiagnostics({
        uri: URI.file(filePath).toString(true),
        diagnostics,
      });
    }, 1000);
    return _lint;
  })();

  connection.onDidOpenTextDocument((params) => {
    const filePath = normalizePath(params.textDocument.uri);
    const content = params.textDocument.text;

    if (!docs[filePath]) {
      docs[filePath] = new Document(
        params.textDocument.uri,
        params.textDocument.languageId,
        params.textDocument.version,
        content
      );
    }
    currentDir = dirname(filePath);
    updateFile(filePath, content);
    lintSystem(filePath);
  });

  connection.onDidChangeTextDocument(
    debounceSameArg(
      (params) => {
        const filePath = normalizePath(params.textDocument.uri);
        const content = params.contentChanges[0].text;
        docs[filePath].update(content, 0, content.length);
        docs[filePath].version++;

        if (currentDir !== dirname(filePath)) {
          currentDir = dirname(filePath);
        }
        updateFile(filePath, content);
        lintSystem(filePath);
      },
      (a, b) => a?.textDocument?.uri === b?.textDocument?.uri,
      1000
    )
  );

  connection.onCompletion((params) => {
    const filePath = normalizePath(params.textDocument.uri);

    return autocompleteAtPosition(
      docs[filePath].offsetAt(params.position),
      filePath,
      params
    );
  });

  const onHover = debounce<(params: HoverParams) => Hover>((params) => {
    const { textDocument, position } = params;
    const filePath = normalizePath(textDocument.uri);

    const sourceDoc = docs[filePath];

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
      range: _textSpanToRange(docs[filePath], info.textSpan),
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
  }, 1000);

  connection.onHover(onHover);

  connection.listen();
};
