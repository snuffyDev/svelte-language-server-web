import { VFS } from "./../src/vfs";
import { globToRegExp } from "../src/deps/glob-to-regexp";
const sync = (glob: string, options) => {
	const regexp = globToRegExp(glob, {
		globstar: true,
		caseInsensitive: true,
		extended: true,
		os: "linux",
	});
	return VFS.readDirectory("/").filter((v) => regexp.exec(v));
};

export default {
	sync,
};
