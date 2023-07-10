/// UNUSED
import {
	Disposable,
	GenericRequestHandler,
	NotificationType,
	ProtocolConnection,
	RequestType,
	RequestType0,
} from "vscode-languageserver-protocol/browser";
import { Connection } from "vscode-languageserver/browser";
type ConnectionMethod<T extends any[], R> = (cb: (...args: T) => R) => void;

interface ConnectionAdapter {
	onInitialize: ConnectionMethod<[], Promise<any>>;
	onInitialized: ConnectionMethod<[], void>;
	sendNotification: <P>(type: NotificationType<P>, params?: P) => void;
	onExit: ConnectionMethod<[], void>;
	onRenameRequest: ConnectionMethod<[], Promise<any>>;
	onPrepareRename: ConnectionMethod<[], Promise<any>>;
	onDidChangeConfiguration: ConnectionMethod<[], void>;
	onDidOpenTextDocument: ConnectionMethod<[], void>;
	onDidCloseTextDocument: ConnectionMethod<[], void>;
	onDidChangeTextDocument: ConnectionMethod<[], void>;
	onHover: ConnectionMethod<[], Promise<any>>;
	onCompletion: ConnectionMethod<[], Promise<any>>;
	onDocumentFormatting: ConnectionMethod<[], Promise<any>>;
	onRequest<R, E>(
		method: string,
		handler: GenericRequestHandler<R, E>,
	): Disposable;

	onDocumentColor: ConnectionMethod<[], Promise<any>>;
	onColorPresentation: ConnectionMethod<[], Promise<any>>;
	onDocumentSymbol: ConnectionMethod<[], Promise<any>>;
	onDefinition: ConnectionMethod<[], Promise<any>>;
	onReferences: ConnectionMethod<[], Promise<any>>;
	onCodeAction: ConnectionMethod<[], Promise<any>>;
	onExecuteCommand: ConnectionMethod<[], Promise<any>>;
	sendRequest: <P, R, E>(type: RequestType<P, R, E>, params?: P) => Promise<R>;
	onCodeActionResolve: ConnectionMethod<[], Promise<any>>;
	onCompletionResolve: ConnectionMethod<[], Promise<any>>;
	onSignatureHelp: ConnectionMethod<[], Promise<any>>;
	onSelectionRanges: ConnectionMethod<[], Promise<any>>;
	onImplementation: ConnectionMethod<[], Promise<any>>;
	onTypeDefinition: ConnectionMethod<[], Promise<any>>;
	sendDiagnostics: <P>(type: NotificationType<P>, params?: P) => void;
	onDidChangeWatchedFiles: ConnectionMethod<[], void>;
	onDidSaveTextDocument: ConnectionMethod<[], void>;
	onNotification: <P>(type: NotificationType<P>, params?: P) => void;
	onRequestCancellation: ConnectionMethod<[string], void>;
}

const adaptProtocolConnectionToConnection = (
	protocolConnection: ProtocolConnection,
): ConnectionAdapter => {
	const connection: Connection = {} as ConnectionAdapter;

	connection.onInitialize = protocolConnection.onRequest.bind(
		protocolConnection,
		"initialize",
	);
	connection.onInitialized = protocolConnection.onNotification.bind(
		protocolConnection,
		"initialized",
	);
	connection.sendNotification =
		protocolConnection.sendNotification.bind(protocolConnection);
	connection.onExit = protocolConnection.onNotification.bind(
		protocolConnection,
		"exit",
	);
	connection.onRenameRequest = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/rename",
	);
	connection.onPrepareRename = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/prepareRename",
	);
	connection.onDidChangeConfiguration = protocolConnection.onNotification.bind(
		protocolConnection,
		"workspace/didChangeConfiguration",
	);
	connection.onDidOpenTextDocument = protocolConnection.onNotification.bind(
		protocolConnection,
		"textDocument/didOpen",
	);
	connection.onDidCloseTextDocument = protocolConnection.onNotification.bind(
		protocolConnection,
		"textDocument/didClose",
	);
	connection.onDidChangeTextDocument = protocolConnection.onNotification.bind(
		protocolConnection,
		"textDocument/didChange",
	);
	connection.onHover = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/hover",
	);
	connection.onCompletion = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/completion",
	);
	connection.onDocumentFormatting = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/formatting",
	);
	connection.onRequest = protocolConnection.onRequest.bind(protocolConnection);
	connection.onDocumentColor = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/documentColor",
	);
	connection.onColorPresentation = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/colorPresentation",
	);
	connection.onDocumentSymbol = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/documentSymbol",
	);
	connection.onDefinition = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/definition",
	);
	connection.onReferences = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/references",
	);
	connection.onCodeAction = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/codeAction",
	);
	connection.onExecuteCommand = protocolConnection.onRequest.bind(
		protocolConnection,
		"workspace/executeCommand",
	);
	connection.sendRequest =
		protocolConnection.sendRequest.bind(protocolConnection);
	connection.onCodeActionResolve = protocolConnection.onRequest.bind(
		protocolConnection,
		"codeAction/resolve",
	);
	connection.onCompletionResolve = protocolConnection.onRequest.bind(
		protocolConnection,
		"completionItem/resolve",
	);
	connection.onSignatureHelp = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/signatureHelp",
	);
	connection.onSelectionRanges = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/selectionRanges",
	);
	connection.onImplementation = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/implementation",
	);
	connection.onTypeDefinition = protocolConnection.onRequest.bind(
		protocolConnection,
		"textDocument/typeDefinition",
	);
	connection.sendDiagnostics = protocolConnection.sendNotification.bind(
		protocolConnection,
		"textDocument/publishDiagnostics",
	);
	connection.onDidChangeWatchedFiles = protocolConnection.onNotification.bind(
		protocolConnection,
		"workspace/didChangeWatchedFiles",
	);
	connection.onDidSaveTextDocument = protocolConnection.onNotification.bind(
		protocolConnection,
		"textDocument/didSave",
	);
	connection.onNotification =
		protocolConnection.onNotification.bind(protocolConnection);
	connection.onRequestCancellation = protocolConnection.onNotification.bind(
		protocolConnection,
		"$/cancelRequest",
	);

	return connection;
};

export { adaptProtocolConnectionToConnection, type ConnectionAdapter };
