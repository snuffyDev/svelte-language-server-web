const { join, normalize,  } = require("path");
const ts = require('typescript/lib/typescript');

console.log({cd: ts.sys.getCurrentDirectory(), getDefaultLibFilePath: ts.getDefaultLibFilePath({})})
const { basename, dirname, parse} = require("path").posix;

console.log(__dirname, dirname(__dirname), basename( __dirname), parse(__dirname), __dirname === (join(dirname(__dirname),basename(__dirname)+ parse(__dirname).ext)));

console.log(normalize('file:///tsconfig.json'))