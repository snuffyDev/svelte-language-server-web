import glob from 'fast-glob';
import { readFileSync, writeFileSync } from 'fs';

const outfile = "./project.json";


const project = glob.sync('./template/**/*', { dot: true, absolute: true });

const projectFiles = project.reduce((acc, file) => {
    const content = readFileSync(file, { encoding: 'utf-8' });
    const publicPath = file.slice(file.indexOf('/template/') + 9);

    acc[publicPath] = content;;
    return acc;
}, {});

writeFileSync(outfile, JSON.stringify(projectFiles, null, 2), { encoding: 'utf-8' });