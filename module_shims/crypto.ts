export default {
	getRandomValues(length: number) {
		const buff = new ArrayBuffer(length);
		return Buffer.from(crypto.getRandomValues(new Uint8Array(buff)));
	},
} as Crypto;
