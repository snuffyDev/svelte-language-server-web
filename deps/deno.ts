import { bundle } from "https://deno.land/x/emit/mod.ts";

const { code } = await bundle('./path.ts', {
	compilerOptions: {
		declaration: true,
		module: "ESNext",
		
	},
	bundle: 'esm',
})

await Deno.writeTextFile("./path-deno.ts", code); 
