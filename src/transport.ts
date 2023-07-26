// https://gitlab.com/aedge/codemirror-web-workers-lsp-demo/-/blob/master/src/App.svelte
export * from "@open-rpc/client-js/build/RequestManager";
import { Transport } from "@open-rpc/client-js/build/transports/Transport";

import { getNotifications } from "@open-rpc/client-js/build/Request";
import type {
	JSONRPCRequestData,
	IJSONRPCData,
} from "@open-rpc/client-js/src/Request";

export default class PostMessageWorkerTransport extends Transport {
	public worker: undefined | null | Worker;
	public postMessageID: string;

	constructor(worker: Worker) {
		super();
		this.worker = worker;

		this.postMessageID = `post-message-transport-${Math.random()}`;
	}

	private messageHandler = (ev: MessageEvent) => {
		console.log("<-", ev.data);
		this.transportRequestManager.resolveResponse(JSON.stringify(ev.data));
	};

	public connect(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			this.worker.addEventListener("message", this.messageHandler);
			resolve();
		});
	}

	public async sendData(
		data: JSONRPCRequestData,
		timeout: number | null = 5000,
	): Promise<any> {
		console.log("->", data);
		const prom = this.transportRequestManager.addRequest(data, timeout);
		const notifications = getNotifications(data);
		if (this.worker) {
			this.worker.postMessage((data as IJSONRPCData).request);
			this.transportRequestManager.settlePendingRequest(notifications);
		}
		return prom;
	}

	public close(): void {
		this.worker.terminate();
	}
}
