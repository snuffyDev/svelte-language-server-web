// import { platform } from "os";

export const EOL = "\n";
export function platform() {
	return "browser";
}

export default {
	EOL,
	platform,
	cpus() {
		return 4;
	},
	type() {
		return "";
	},
};
