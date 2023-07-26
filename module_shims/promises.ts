import fs from "fs";
export default new Proxy(fs, {
	apply(target, thisArg, argArray) {
		console.log({ target, thisArg, argArray });
	},
	get(target, p, receiver) {
		console.log({ target, p, receiver });
	},
});
