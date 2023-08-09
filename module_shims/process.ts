function unimplemented(name: string): void {
	throw new Error(
		"Node.js process " +
			name +
			" is not supported by JSPM core outside of Node.js",
	);
}

let queue = [];
let draining = false;
let currentQueue: { run: () => void }[] | null;
let queueIndex = -1;

function cleanUpNextTick() {
	if (!draining || !currentQueue) return;
	draining = false;
	if (currentQueue.length) {
		queue = currentQueue.concat(queue);
	} else {
		queueIndex = -1;
	}
	if (queue.length) drainQueue();
}

function drainQueue() {
	if (draining) return;
	let timeout = setTimeout(cleanUpNextTick, 0);
	draining = true;

	let len = queue.length;
	while (len) {
		currentQueue = queue;
		queue = [];
		while (++queueIndex < len) {
			if (currentQueue) currentQueue[queueIndex].run();
		}
		queueIndex = -1;
		len = queue.length;
	}
	currentQueue = null;
	draining = false;
	clearTimeout(timeout);
}

function nextTick(fun: any) {
	let args = new Array(arguments.length - 1);
	if (arguments.length > 1) {
		for (let i = 1; i < arguments.length; i++) args[i - 1] = arguments[i];
	}
	queue.push(new Item(fun, args));
	if (queue.length === 1 && !draining) setTimeout(drainQueue, 0);
}
// v8 likes predictible objects
function Item(fun: any, array: any[]) {
	this.fun = fun;
	this.array = array;
}
Item.prototype.run = function () {
	this.fun.apply(null, this.array);
};

let title = "linux";
let arch = "x64";
let platform = "linux";
let env = {
	PATH: "/usr/bin",
	LANG: navigator.language + ".UTF-8",
	PWD: "/",
	HOME: "/home",
	DEBUG: "",
	TMP: "/tmp",
};
let argv = ["/usr/bin/node"];
let execArgv = [];
let version = "v16.8.0";
let versions = { node: version };

let emitWarning = function (message: string, type: string) {
	console.warn((type ? type + ": " : "") + message);
};

let binding = function (_name: any) {
	unimplemented("binding");
};
let browser = false;
let umask = function (_mask: any) {
	return 0;
};
let _cwd = "/";
let cwd = function () {
	return _cwd;
};
let chdir = function (dir: string) {
	_cwd = dir;
};

let release = {
	name: "node",
	sourceUrl: "",
	headersUrl: "",
	libUrl: "",
};

function noop() {}

let _rawDebug = noop;
let moduleLoadList = [];
function _linkedBinding(_name: any) {
	unimplemented("_linkedBinding");
}
let domain = {};
let _exiting = false;
let config = {};
function dlopen(_name: any) {
	unimplemented("dlopen");
}
function _getActiveRequests() {
	return [];
}
function _getActiveHandles() {
	return [];
}
let reallyExit = noop;
let _kill = noop;
let cpuUsage = function () {
	return {};
};
let resourceUsage = cpuUsage;
let memoryUsage = cpuUsage;
let kill = noop;
let exit = noop;
let openStdin = noop;
let allowedNodeEnvironmentFlags = {};
function assert(condition: any, message: any) {
	if (!condition) throw new Error(message || "assertion error");
}
let features = {
	inspector: false,
	debug: false,
	uv: false,
	ipv6: false,
	tls_alpn: false,
	tls_sni: false,
	tls_ocsp: false,
	tls: false,
	cached_builtins: true,
};
let _fatalExceptions = noop;
let setUncaughtExceptionCaptureCallback = noop;
function hasUncaughtExceptionCaptureCallback() {
	return false;
}
let _tickCallback = noop;
let _debugProcess = noop;
let _debugEnd = noop;
let _startProfilerIdleNotifier = noop;
let _stopProfilerIdleNotifier = noop;
let stdout = undefined;
let stderr = undefined;
let stdin = undefined;
let abort = noop;
let pid = 2;
let ppid = 1;
let execPath = "/bin/usr/node";
let debugPort = 9229;
let argv0 = "node";
let _preload_modules = [];
let setSourceMapsEnabled = noop;

let _performance = {
	now:
		typeof performance !== "undefined"
			? performance.now.bind(performance)
			: undefined,
	timing: typeof performance !== "undefined" ? performance.timing : undefined,
};
if (_performance.now === undefined) {
	let nowOffset = Date.now();

	if (_performance.timing && _performance.timing.navigationStart) {
		nowOffset = _performance.timing.navigationStart;
	}
	_performance.now = () => Date.now() - nowOffset;
}

function uptime() {
	return _performance.now() / 1000;
}

let nanoPerSec = 1000000000;
function hrtime(previousTimestamp: number[]) {
	let baseNow = Math.floor((Date.now() - _performance.now()) * 1e-3);
	let clocktime = _performance.now() * 1e-3;
	let seconds = Math.floor(clocktime) + baseNow;
	let nanoseconds = Math.floor((clocktime % 1) * 1e9);
	if (previousTimestamp) {
		seconds = seconds - previousTimestamp[0];
		nanoseconds = nanoseconds - previousTimestamp[1];
		if (nanoseconds < 0) {
			seconds--;
			nanoseconds += nanoPerSec;
		}
	}
	return [seconds, nanoseconds];
}
hrtime.bigint = function (time: any) {
	let diff = hrtime(time);
	if (typeof BigInt === "undefined") {
		return diff[0] * nanoPerSec + diff[1];
	}
	return BigInt(diff[0] * nanoPerSec) + BigInt(diff[1]);
};

let _maxListeners = 10;
let _events = {};
let _eventsCount = 0;
function on() {
	return process;
}
let addListener = on;
let once = on;
let off = on;
let removeListener = on;
let removeAllListeners = on;
let emit = noop;
let prependListener = on;
let prependOnceListener = on;
function listeners(_name: any) {
	return [];
}
let process = {
	version,
	versions,
	arch,
	platform,
	release,
	_rawDebug,
	moduleLoadList,
	binding,
	_linkedBinding,
	_events,
	_eventsCount,
	_maxListeners,
	on,
	addListener,
	once,
	off,
	removeListener,
	removeAllListeners,
	emit,
	prependListener,
	prependOnceListener,
	listeners,
	domain,
	_exiting,
	config,
	dlopen,
	uptime,
	_getActiveRequests,
	_getActiveHandles,
	reallyExit,
	_kill,
	cpuUsage,
	resourceUsage,
	memoryUsage,
	kill,
	exit,
	openStdin,
	allowedNodeEnvironmentFlags,
	assert,
	features,
	_fatalExceptions,
	setUncaughtExceptionCaptureCallback,
	hasUncaughtExceptionCaptureCallback,
	emitWarning,
	nextTick,
	_tickCallback,
	_debugProcess,
	_debugEnd,
	_startProfilerIdleNotifier,
	_stopProfilerIdleNotifier,
	stdout,
	stdin,
	stderr,
	abort,
	umask,
	chdir,
	cwd,
	env,
	title,
	argv,
	execArgv,
	pid,
	ppid,
	execPath,
	debugPort,
	hrtime,
	argv0,
	_preload_modules,
	setSourceMapsEnabled,
};

export {
	_debugEnd,
	_debugProcess,
	_events,
	_eventsCount,
	_exiting,
	_fatalExceptions,
	_getActiveHandles,
	_getActiveRequests,
	_kill,
	_linkedBinding,
	_maxListeners,
	_preload_modules,
	_rawDebug,
	_startProfilerIdleNotifier,
	_stopProfilerIdleNotifier,
	_tickCallback,
	abort,
	addListener,
	allowedNodeEnvironmentFlags,
	arch,
	argv,
	argv0,
	assert,
	binding,
	chdir,
	config,
	cpuUsage,
	cwd,
	debugPort,
	dlopen,
	domain,
	emit,
	emitWarning,
	env,
	execArgv,
	execPath,
	exit,
	features,
	hasUncaughtExceptionCaptureCallback,
	hrtime,
	kill,
	listeners,
	memoryUsage,
	moduleLoadList,
	nextTick,
	off,
	on,
	once,
	openStdin,
	pid,
	platform,
	ppid,
	prependListener,
	prependOnceListener,
	reallyExit,
	release,
	removeAllListeners,
	removeListener,
	resourceUsage,
	setSourceMapsEnabled,
	setUncaughtExceptionCaptureCallback,
	stderr,
	stdin,
	stdout,
	title,
	umask,
	uptime,
	version,
	versions,
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
const processProxy = new Proxy(
	process as unknown as NodeJS.Process,
	processProxyHandler,
);

// Export the Proxy as the process object
const _process = processProxy as typeof processProxy & NodeJS.Process;

export default (() => _process)();

globalThis._process = _process;
