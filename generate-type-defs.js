import glob from 'fast-glob';
import { readFileSync, writeFileSync } from 'fs';

const outfile = "./src/svelte-types.json";


const svelte = glob.sync("./node_modules/svelte/**/*.d.ts", { absolute: true });
const svelte2tsx = glob.sync("./node_modules/svelte2tsx/**/*.d.ts", { absolute: true });
const svelteCheck = glob.sync("./node_modules/svelte-check/dist/**/*.d.ts", { absolute: true });
const sveltePreprocess = glob.sync("./node_modules/svelte-preprocess/dist/**/*.d.ts", { absolute: true });

const svelteTypes = [...svelte, ...svelte2tsx, ...svelteCheck, ...sveltePreprocess];
console.log(svelteTypes)
const svelteTypesMap = svelteTypes.reduce((acc, path) => {

    const publicPath = path.slice(path.indexOf("/node_modules/"))
    acc[publicPath] = readFileSync(path, { encoding: 'utf-8' });
    return acc;
}, {});



writeFileSync(outfile, JSON.stringify(svelteTypesMap, null, 2), { encoding: 'utf-8' });