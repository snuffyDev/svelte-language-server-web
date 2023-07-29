// Define a minimal process object with some properties and methods
const baseProcess: NodeJS.Process = {
	env: {
		DEBUG: "",
	}, // Environment variables (empty for simplicity)
	cwd: () => "/",
	exit: (code?: number) => {
		/* Placeholder implementation */
	},
	on: (event: string, listener: (...args: any[]) => void) => {
		/* Placeholder implementation */
	},
	// Add more properties and methods as needed for your use case
};

// Define the handler for the Proxy
const processProxyHandler: ProxyHandler<NodeJS.Process> = {
	// This trap intercepts property access on the process object
	get(target, property, receiver) {
		if (property === "STYLUS_COV") return false;
		// Check if the property exists on the target object
		if (property in target) {
			return Reflect.get(target, property, receiver);
		}

		// Handle access to undefined properties (add custom logic here)
		console.warn(
			`Access to undefined property "${String(property)}" on process object.`,
		);
		Reflect.set(target, property, receiver[property]);
		return Reflect.get(target, property, receiver);
	},

	// This trap intercepts function invocations on the process object
	apply(target, thisArg, argArray) {
		// Check if the target is a function (method) on the process object
		if (typeof target === "function") {
			return Reflect.apply(target, thisArg, argArray);
		}

		// Handle function invocations on non-function properties (add custom logic here)
		console.warn("Trying to call a non-function property on process object.");
		return undefined;
	},

	// This trap intercepts property assignment on the process object
	set(target, property, value, receiver) {
		// Handle property assignment (add custom logic here)
		console.log(`Setting property "${String(property)}" on process object.`);
		return Reflect.set(target, property, value, receiver);
	},
};

// Create the Proxy for the process object, including its properties and methods
const processProxy = new Proxy(baseProcess, processProxyHandler);

// Export the Proxy as the process object
const _process = processProxy as typeof processProxy & NodeJS.Process;
export default (() => _process)();

const {
	abort,
	addListener,
	allowedNodeEnvironmentFlags,
	arch,
	argv,
	argv0,
	browser,
	chdir,
} = process;
export {
	abort,
	addListener,
	allowedNodeEnvironmentFlags,
	arch,
	argv,
	argv0,
	browser,
	chdir,
};
