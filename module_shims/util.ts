// In addition to being accessible through util.promisify.custom,
// this symbol is registered globally and can be accessed in any environment as
// Symbol.for('nodejs.util.promisify.custom').
const kCustomPromisifiedSymbol = Symbol.for("nodejs.util.promisify.custom");
// This is an internal Node symbol used by functions returning multiple
// arguments, e.g. ['bytesRead', 'buffer'] for fs.read().
const kCustomPromisifyArgsSymbol = Symbol.for(
	"nodejs.util.promisify.customArgs",
);

export const customPromisifyArgs = kCustomPromisifyArgsSymbol;
function promisify(original) {
	if (typeof original !== "function") return () => Promise.resolve(original);

	if (original[kCustomPromisifiedSymbol]) {
		const fn = original[kCustomPromisifiedSymbol];

		return Object.defineProperty(fn, kCustomPromisifiedSymbol, {
			value: fn,
			enumerable: false,
			writable: false,
			configurable: true,
		});
	}

	// Names to create an object from in case the callback receives multiple
	// arguments, e.g. ['bytesRead', 'buffer'] for fs.read.
	const argumentNames = original[kCustomPromisifyArgsSymbol];
	function fn(...args) {
		return new Promise((resolve, reject) => {
			args.push((err, ...values) => {
				if (err) {
					return reject(err);
				}
				if (argumentNames !== undefined && values.length > 1) {
					const obj = {};
					for (let i = 0; i < argumentNames.length; i++) {
						obj[argumentNames[i]] = values[i];
					}
					resolve(obj);
				} else {
					resolve(values[0]);
				}
			});
			Reflect.apply(original, this, args);
		});
	}

	Object.setPrototypeOf(fn, Object.getPrototypeOf(original));

	Object.defineProperty(fn, kCustomPromisifiedSymbol, {
		value: fn,
		enumerable: false,
		writable: false,
		configurable: true,
	});
	return Object.defineProperties(
		fn,
		Object.getOwnPropertyDescriptors(original),
	);
}
var _TextDecoder = TextDecoder;
export { _TextDecoder as TextDecoder, promisify };

export default { TextDecoder, promisify };
