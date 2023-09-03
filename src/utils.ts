import { marked } from "marked";
import { Hover } from "vscode-languageserver-protocol";

export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
	let timeout: NodeJS.Timeout | undefined;

	return (...args: Parameters<T>) => {
		return new Promise((resolve) => {
			if (timeout) {
				clearTimeout(timeout);
			}

			timeout = setTimeout(() => {
				timeout = undefined;
				resolve(func(...args));
			}, wait);
		});
	};
}

export function batchUpdates<T>(
	callback: (...args: T extends [...args: any[]] ? T[][] : T[]) => void,
	maxItems = 500,
	wait = 500,
) {
	const items: T[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined = undefined;

	return function batched(...args: T extends [...args: any[]] ? T : T[]) {
		items.push.apply(items, [args] as T[]);
		if (items.length >= maxItems) {
			clearTimeout(timer);
			callback(items.slice() as never);
			items.length = 0;
			return;
		}

		clearTimeout(timer);

		timer = setTimeout(() => {
			callback(items.slice() as never);
			items.length = 0;
		}, wait);
	};
}

export function transformHoverResultToHtml(result: Hover) {
	if (!result) return result;
	if (Array.isArray(result.contents)) {
		result.contents = result.contents.map((v) => {
			return typeof v === "string"
				? marked.parse(v, { gfm: true, breaks: true })
				: {
						value: marked.parse(v.value, { breaks: true, gfm: true }),
						language: v.language,
				  };
		});
	} else if (typeof result.contents === "string") {
		result.contents = marked.parse(result.contents, { gfm: true });
	} else {
		result.contents = marked.parse(result.contents.value, { gfm: true });
	}
	return result;
}
