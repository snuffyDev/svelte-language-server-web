const { join, normalize,  } = require("path");

const { basename, dirname, parse} = require("path").posix;

console.log(__dirname, dirname(__dirname), basename( __dirname), parse(__dirname), __dirname === (join(dirname(__dirname),basename(__dirname)+ parse(__dirname).ext)));

console.log(normalize('file:///tsconfig.json'))