import { marked } from "marked";
import { Hover } from "vscode-languageserver-protocol";

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    return new Promise((resolve) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      timeout = setTimeout(() => {
        timeout = undefined;
        resolve(func(...args));
      }, wait);
    });
  };
}

/*
	Create a functional implemtation of the `vscode.workspace` API.
 */

export function batchUpdates<T>(
  callback: (...args: T extends [...args: any[]] ? T[][] : T[]) => void,
  maxItems = 500,
  wait = 500
) {
  const items: T[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  return function batched<A = unknown>(
    ...args: A extends [...infer T]
      ? [...A]
      : T extends [...args: any[]]
      ? [...args: T[]]
      : [T]
  ) {
    items.push.apply(items, [args] as T[]);
    if (items.length >= maxItems) {
      clearTimeout(timer);
      // @ts-ignore
      callback(items.slice() as never);
      items.length = 0;
      return;
    }

    clearTimeout(timer);

    timer = setTimeout(() => {
      // @ts-ignore
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
        ? marked.parse(v, {
            gfm: true,
            breaks: true,
            mangle: false,
            headerIds: false,
          })
        : {
            value: marked.parse(v.value, {
              breaks: true,
              gfm: true,
              mangle: false,
              headerIds: false,
            }),
            language: v.language,
          };
    });
  } else if (typeof result.contents === "string") {
    result.contents = marked.parse(result.contents, {
      gfm: true,
      mangle: false,
      headerIds: false,
    });
  } else {
    result.contents = marked.parse(result.contents.value, {
      gfm: true,
      mangle: false,
      headerIds: false,
    });
  }
  return result;
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
) {
  let last: number;
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (last && now < last + wait) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        last = now;
        func(...args);
      }, wait);
    } else {
      last = now;
      func(...args);
    }
  };
}
//
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
) {
  const queue: {
    resolve: (value?: ReturnType<T>) => void;
    args: Parameters<T>;
  }[] = [];
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    return new Promise<any>((resolve) => {
      queue.push({ resolve, args });

      if (!timeout) {
        timeout = setTimeout(async () => {
          timeout = undefined;
          const { resolve, args } = queue.shift()!;
          resolve(await func(...args));
        }, wait);
      } else {
        resolve(undefined as never);
      }
    });
  };
}
