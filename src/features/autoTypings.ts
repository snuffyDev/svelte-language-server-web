type PackageJSON = {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	bundleDependencies?: Record<string, string>;
	bundledDependencies?: Record<string, string>;
	types?: string;
	typings?: string;
	typesVersions?: Record<string, Record<string, string>>;
	main?: string;
	module?: string;
	browser?: string;
	bin?: Record<string, string>;
};

export class PromisePool {
	private pendingTasks: Array<() => Promise<any>> = new Array();
	private activeTasks: number = 0;

	constructor(private readonly concurrency: number) {}

	private async runTask(task: () => Promise<any>): Promise<void> {
		this.activeTasks++;
		try {
			await task();
		} finally {
			this.activeTasks--;
			this.runNext();
		}
	}

	private runNext(): void {
		if (this.activeTasks < this.concurrency && this.pendingTasks.length > 0) {
			const nextTask = this.pendingTasks.shift()!;
			this.runTask(nextTask);
		}
	}

	async add<T>(task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const wrappedTask = async () => {
				try {
					const result = await task();
					resolve(result);
				} catch (error) {
					reject(error);
				}
			};

			this.pendingTasks.push(wrappedTask);
			this.runNext();
		});
	}
}

const pool = new PromisePool(20);

const HEAD_REQUEST = (name: string, version: string) => {
	return fetch(`https://cdn.skypack.dev/${name}@${version}?dts`, {
		method: "HEAD",
	})
		.then(({ headers }) => {
			return headers.get("x-typescript-types");
		})
		.then((path) => {
			if (path) {
				return fetch(`https://cdn.skypack.dev${path}`).then((r) => r.text());
			}
			return null;
		});
};

const DEPENDENCY_KEYS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
	"bundleDependencies",
	"bundledDependencies",
];
export const fetchTypeDefinitionsFromCDN = async (packageJSON: PackageJSON) => {
	const dependencies: Record<string, string> = {};
	for (const key of DEPENDENCY_KEYS) {
		console.log(key in packageJSON, packageJSON);
		if (key in packageJSON) {
			const { svelte = undefined, ...rest } = packageJSON[key];
			Object.assign(dependencies, rest);
		}
	}
	const types = await Promise.all(
		Object.keys(dependencies).map((name) =>
			pool.add(async () => {
				const version = dependencies[name];
				const text = await HEAD_REQUEST(name, version);
				if (text) {
					return [name, text];
				}
			}),
		),
	);
	console.log(types);

	return (types || []).filter(Boolean) as [pkgName: string, dts: string][];
};
