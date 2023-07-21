
import { createBundle } from "dts-buddy";

await createBundle({project: './tsconfig.json',modules: {'lib_entry.ts': './src/lib_entry.ts'},output: './dist/'});