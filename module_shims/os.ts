/** esbuild-ignore */
// @ts=ignore
import process from "process";

export const EOL = "\n";
export function platform() {
	return "browser";
}

const mod = {
	EOL,
	platform,
	cpus() {
		return 4;
	},
	type() {
		return "";
	},
};

export default mod;
