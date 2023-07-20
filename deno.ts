import { bundle } from "https://deno.land/x/emit/mod.ts";

const { code } = await bundle("./_glob.ts", {
	compilerOptions: {
		declaration: true,
		module: "ESNext",
	},
	bundle: "esm",
});

await Deno.writeTextFile("./glob-to-regexp.ts", code);
