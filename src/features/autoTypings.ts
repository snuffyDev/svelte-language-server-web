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

const KNOWN_MODULE_CACHE = new Set<string>();

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

const pool = new PromisePool(5);
const numberRegex = /[^\d\.]/gm;
let packageRetryTracker = {};

const HEAD_REQUEST = (
  packageName: string,
  version: string
): Promise<[string, string][]> => {
  if (packageRetryTracker[packageName] > 2) {
    return null;
  }
  packageRetryTracker[packageName] = packageRetryTracker[packageName] || 0;
  return fetch(
    `https://data.jsdelivr.com/v1/packages/npm/${packageName}${
      version ? `@${version}` : ""
    }?structure=flat`
  ).then(async (res) => {
    if (res.status >= 400) {
      packageRetryTracker[packageName]++;

      return HEAD_REQUEST(packageName, "");
    }
    const data = await res.json();
    const { files = [] } = data ?? {};
    return await Promise.all(
      (files || [])
        .filter(
          (file) =>
            file &&
            file?.name &&
            (!file.name.endsWith(".js") || !file.name.endsWith(".md"))
        )
        .map(async ({ name }) => [
          `${packageName}${name}`,
          await fetch(
            `https://cdn.jsdelivr.net/npm/${packageName}@${version}${name}`
          )
            .then((r) => r.text())
            .catch(() => ""),
        ])
    );
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
    if (key in packageJSON) {
      const { svelte = undefined, ...rest } = packageJSON[key];
      Object.assign(dependencies, rest);
    }
  }
  const types = await Promise.allSettled(
    Object.keys(dependencies).map((name) =>
      pool.add(async () => {
        const version = dependencies[name];
        const results = await HEAD_REQUEST(
          name,
          version.replace(numberRegex, "")
        );
        if (results) {
          KNOWN_MODULE_CACHE.add(name);
          return results;
        }
      })
    )
  ).then((results) => {
    const fulfilledResults = results.filter(
      (result): result is PromiseFulfilledResult<[string, string][]> =>
        result.status === "fulfilled"
    );
    return fulfilledResults.flatMap((result) => result.value);
  });
  packageRetryTracker = {};
  return (types || []).filter(Boolean) as [pkgName: string, dts: string][];
};
