
import { createBundle } from "dts-buddy";

await createBundle({project: './tsconfig.json',modules: {'index.js': './src/index.ts'},output: './dist/index.d.ts'});