import { createSystem } from "@typescript/vfs";
import json from "./libs.json?raw";
const fsMap = new Map(
	Object.entries(JSON.parse(json)).map(([key, value]) => [
		`/node_modules/typescript/lib/${key}`,
		value,
	]),
);
console.log(fsMap);
export default createSystem(fsMap);
