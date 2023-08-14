import { Logger } from "../../logger";
import { _Function } from "../../../../../global_patches";
import { CompileOptions } from "svelte/types/compiler/interfaces";
import { PreprocessorGroup } from "svelte/types/compiler/preprocess";
import { importSveltePreprocess } from "../../importPackage";
import _glob from "fast-glob";
import _path from "path";
import _fs, { readFileSync } from "fs";
import { URL } from "url";
import { FileMap } from "./fileCollection";

const pathToFileURL = (url) => _path.posix.toFileUrl(url);

export type InternalPreprocessorGroup = PreprocessorGroup & {
	/**
	 * svelte-preprocess has this since 4.x
	 */
	defaultLanguages?: {
		markup?: string;
		script?: string;
		style?: string;
	};
};

export interface SvelteConfig {
	compilerOptions?: CompileOptions;
	isFallbackConfig?: boolean;
	kit?: any;
	loadConfigError?: any;
	preprocess?: InternalPreprocessorGroup | InternalPreprocessorGroup[];
}

const DEFAULT_OPTIONS: CompileOptions = {
	dev: true,
};

const NO_GENERATE: CompileOptions = {
	generate: false,
};

/**
 * This function encapsulates the import call in a way
 * that TypeScript does not transpile `import()`.
 * https://github.com/microsoft/TypeScript/issues/43329
 */
const _dynamicImport = new Function(
	"modulePath",
	"return import(modulePath)",
) as (modulePath: URL) => Promise<any>;

/**
 * Loads svelte.config.{js,cjs,mjs} files. Provides both a synchronous and asynchronous
 * interface to get a config file because snapshots need access to it synchronously.
 * This means that another instance (the ts service host on startup) should make
 * sure that all config files are loaded before snapshots are retrieved.
 * Asynchronousity is needed because we use the dynamic `import()` statement.
 */
export class ConfigLoader {
	private configFiles = new FileMap<SvelteConfig>();
	private configFilesAsync = new FileMap<Promise<SvelteConfig>>();
	private disabled = false;
	private filePathToConfigPath = new FileMap<string>();

	constructor(
		private globSync: typeof _glob.sync,
		private fs: Pick<typeof _fs, "existsSync">,
		private path: Pick<typeof _path, "dirname" | "relative" | "join">,
		private dynamicImport: typeof _dynamicImport,
	) {}

	/**
	 * Like `getConfig`, but will search for a config above if no config found.
	 */
	public async awaitConfig(file: string): Promise<SvelteConfig | undefined> {
		const config = this.getConfig(file);
		if (config) {
			return config;
		}

		const fileDirectory = this.path.dirname(file);
		const configPath = this.searchConfigPathUpwards(fileDirectory);
		if (configPath) {
			await this.loadAndCacheConfig(configPath, fileDirectory);
		} else {
			await this.addFallbackConfig(fileDirectory);
		}
		return this.getConfig(file);
	}

	/**
	 * Returns config associated to file. If no config is found, the file
	 * was called in a context where no config file search was done before,
	 * which can happen
	 * - if TS intellisense is turned off and the search did not run on tsconfig init
	 * - if the file was opened not through the TS service crawl, but through the LSP
	 *
	 * @param file
	 */
	public getConfig(file: string): SvelteConfig | undefined {
		const cached = this.filePathToConfigPath.get(file);
		if (cached) {
			return this.configFiles.get(cached);
		}

		let currentDir = file;
		let nextDir = this.path.dirname(file);
		while (currentDir !== nextDir) {
			currentDir = nextDir;
			const config =
				this.tryGetConfig(file, currentDir, "js") ||
				this.tryGetConfig(file, currentDir, "cjs") ||
				this.tryGetConfig(file, currentDir, "mjs");
			if (config) {
				return config;
			}
			nextDir = this.path.dirname(currentDir);
		}
	}

	/**
	 * Tries to load all `svelte.config.js` files below given directory
	 * and the first one found inside/above that directory.
	 *
	 * @param directory Directory where to load the configs from
	 */
	public async loadConfigs(directory: string): Promise<void> {
		Logger.log("Trying to load configs for", directory);

		try {
			const pathResults = this.globSync("**/svelte.config.{js,cjs,mjs}", {
				cwd: directory,
				// the second pattern is necessary because else fast-glob treats .tmp/../node_modules/.. as a valid match for some reason
				ignore: ["**/node_modules/**", "**/.*/**"],
				onlyFiles: true,
			});
			console.log({ pathResults });
			const someConfigIsImmediateFileInDirectory =
				pathResults.length > 0 &&
				pathResults.some((res) => !this.path.dirname(res));
			if (!someConfigIsImmediateFileInDirectory) {
				const configPathUpwards = this.searchConfigPathUpwards(directory);
				if (configPathUpwards) {
					pathResults.push(this.path.relative(directory, configPathUpwards));
				}
			}
			if (pathResults.length === 0) {
				this.addFallbackConfig(directory);
				return;
			}

			const promises = pathResults
				.map((pathResult) => this.path.join(directory, pathResult))
				.filter((pathResult) => {
					const config = this.configFiles.get(pathResult);
					return !config || config.loadConfigError;
				})
				.map(async (pathResult) => {
					await this.loadAndCacheConfig(pathResult, directory);
				});
			await Promise.all(promises);
		} catch (e) {
			Logger.error(e);
		}
	}

	/**
	 * Enable/disable loading of configs (for security reasons for example)
	 */
	public setDisabled(disabled: boolean): void {
		this.disabled = disabled;
	}

	private async addFallbackConfig(directory: string) {
		const fallback = await this.useFallbackPreprocessor(directory, false);
		const path = this.path.join(directory, "svelte.config.js");
		this.configFilesAsync.set(path, Promise.resolve(fallback));
		this.configFiles.set(path, fallback);
	}

	private async loadAndCacheConfig(configPath: string, directory: string) {
		const loadingConfig = this.configFilesAsync.get(configPath);
		if (loadingConfig) {
			await loadingConfig;
		} else {
			const newConfig = this.loadConfig(configPath, directory);
			this.configFilesAsync.set(configPath, newConfig);
			this.configFiles.set(configPath, await newConfig);
		}
	}

	private async loadConfig(configPath: string, directory: string) {
		try {
			const configFile = this.fs.readFileSync(configPath);
			const processor = {};
			const reqPreProcess = globalThis.__importDefault(`svelte-preprocess`);
			for (const key in reqPreProcess.default) {
				processor[key] = `${reqPreProcess.default[key].toString()}`;
			}
			console.log({ processor });
			// convert processor to a base64 string, while keeping the functions intact
			const processorString = `export default () => (${JSON.stringify(
				processor,
			)})`;
			console.log({ processorString });
			// convert the base64 string into a data url

			// convert the data url into a object url
			const processorObjectUrl = globalThis.URL.createObjectURL(
				new Blob([processorString], { type: "application/javascript" }),
			);
			/** @vite-ignore */

			let config = this.disabled
				? {}
				: (
						await import(
							`data:application/javascript;base64,${btoa(
								configFile.replace(
									"'svelte-preprocess';",
									`'${processorObjectUrl}';`,
								),
							)}`
						)
				  )?.default;
			// console.log({ config });		if (args.join("") === "modulePathreturn import(modulePath)")

			for (const key in config.preprocess) {
				config.preprocess[key] = new Function(
					"return " + config.preprocess[key],
				)();
			}
			if (!config) {
				throw new Error(
					'Missing exports in the config. Make sure to include "export default config" or "module.exports = config"',
				);
			}
			config = {
				...config,
				compilerOptions: {
					...DEFAULT_OPTIONS,
					...config.compilerOptions,
					...NO_GENERATE,
				},
			};
			Logger.log("Loaded config at ", configPath);
			return config;
		} catch (err) {
			Logger.error("Error while loading config at ", configPath);
			Logger.error(err);
			const config = {
				...(await this.useFallbackPreprocessor(directory, true)),
				compilerOptions: {
					...DEFAULT_OPTIONS,
					...NO_GENERATE,
				},
				loadConfigError: err,
			};
			return config;
		}
	}

	private searchConfigPathUpwards(path: string) {
		let currentDir = path;
		let nextDir = this.path.dirname(path);
		while (currentDir !== nextDir) {
			const tryFindConfigPath = (ending: string) => {
				const path = this.path.join(currentDir, `svelte.config.${ending}`);
				console.log({ path });
				return this.fs.existsSync(path) ? path : undefined;
			};
			const configPath =
				tryFindConfigPath("js") ||
				tryFindConfigPath("cjs") ||
				tryFindConfigPath("mjs");
			if (configPath) {
				return configPath;
			}

			currentDir = nextDir;
			nextDir = this.path.dirname(currentDir);
		}
	}

	private tryGetConfig(
		file: string,
		fromDirectory: string,
		configFileEnding: string,
	) {
		const path = this.path.join(
			fromDirectory,
			`svelte.config.${configFileEnding}`,
		);
		const config = this.configFiles.get(path);
		if (config) {
			this.filePathToConfigPath.set(file, path);
			return config;
		}
	}

	private async useFallbackPreprocessor(
		path: string,
		foundConfig: boolean,
	): Promise<SvelteConfig> {
		Logger.log(
			(foundConfig
				? "Found svelte.config.js but there was an error loading it. "
				: "No svelte.config.js found. ") +
				"Using https://github.com/sveltejs/svelte-preprocess as fallback",
		);
		const sveltePreprocess = require("svelte-preprocess");
		return {
			preprocess: sveltePreprocess({
				// 4.x does not have transpileOnly anymore, but if the user has version 3.x
				// in his repo, that one is loaded instead, for which we still need this.
				typescript: <any>{
					transpileOnly: true,
					compilerOptions: { sourceMap: true, inlineSourceMap: false },
				},
			}),
			isFallbackConfig: true,
		};
	}
}

export const configLoader = new ConfigLoader(
	_glob.sync,
	_fs,
	_path,
	_dynamicImport,
);
console.log({ configLoader });
