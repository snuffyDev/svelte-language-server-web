import fs from "fs";
export default new Proxy(fs, {
	apply(target, thisArg, argArray) {},
	get(target, p, receiver) {},
});
