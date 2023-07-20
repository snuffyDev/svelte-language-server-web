// import { platform } from "os";

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
