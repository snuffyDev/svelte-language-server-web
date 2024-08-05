import glob from 'fast-glob';
import { readFileSync, writeFileSync } from 'fs';
import { unescape } from 'querystring';

const outfile = "./project.json";

// const node_modules = glob.sync('./template/node_modules/**/*', { dot: true, absolute: true });

const project = glob.sync('./template/**/*', { ignore: ['./template/node_modules/.pnpm/**', './template/node_modules/vite/**', './template/node_modules/prettier/**', './template/node_modules/eslint*/**', './template/node_modules/.vite/**', './template/node_modules/**/.bin/**'], dot: true, absolute: true });

// Regex for matching media files, binaries, images
const mediaRegex = /.*\.(.*map|mp4|ogg|mp3|wav|flac|aac|wasm|js)$/;
const projectFiles = project.reduce((acc, file) => {
    if (mediaRegex.test(file)) return acc;
    if (file === 'esbuild' || file === 'vite' || file.match(/p?npm-lock(file)?/)) return acc;
    const content = readFileSync(file, { encoding: 'utf-8' });
    const publicPath = file.slice(file.indexOf('/template/') + 9);

    acc[publicPath] = unescape(content.replace(/"/g, '\"'));
    return acc;
}, {});

writeFileSync(outfile, JSON.stringify(projectFiles, null, 2), { encoding: 'utf-8' });