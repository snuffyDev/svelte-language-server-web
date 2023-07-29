
import { createBundle } from "dts-buddy";

await createBundle({project: './tsconfig.json',modules: {'index.js': './src/index.ts'},output: '../../../Documents/GitHub/SvelteLab/src/lib/language_servers/svelte//index.d.ts'});