//@ts-ignore
import mod from "./../fsImpl";

let {
	existsSync,
	lstat,
	openSync,
	readFile,
	readFileSync,
	readdir,
	readdirSync,
	realpathSync,
	stat,
	statSync,
} = mod;
export default mod;
export {
	existsSync,
	lstat,
	openSync,
	readFile,
	readFileSync,
	readdir,
	readdirSync,
	realpathSync,
	stat,
	statSync,
};
