// from: src/deps/svelte-language-server/src/utils.ts
/**
 * Debounces a function but cancels previous invocation only if
 * a second function determines it should.
 *
 * @param fn The function with it's argument
 * @param determineIfSame The function which determines if the previous invocation should be canceld or not
 * @param miliseconds Number of miliseconds to debounce
 */
export function debounceSameArg<T>(
  fn: (arg: T) => void,
  shouldCancelPrevious: (newArg: T, prevArg?: T) => boolean,
  miliseconds: number
): (arg: T) => void {
  let timeout: any;
  let prevArg: T | undefined;

  return async (arg: T) => {
    if (shouldCancelPrevious(arg, prevArg)) {
      clearTimeout(timeout);
    }

    prevArg = arg;
    timeout = setTimeout(() => {
      fn(arg);
      prevArg = undefined;
    }, miliseconds);
  };
}

// from: src/deps/svelte-language-server/src/utils.ts
/**
 * Debounces a function but also waits at minimum the specified number of miliseconds until
 * the next invocation. This avoids needless calls when a synchronous call (like diagnostics)
 * took too long and the whole timeout of the next call was eaten up already.
 *
 * @param fn The function
 * @param miliseconds Number of miliseconds to debounce/throttle
 */
export function debounceThrottle<T>(
  fn: (...args: T[]) => void,
  miliseconds: number
): (...args: T[]) => void {
  let timeout: any;
  let lastInvocation = Date.now() - miliseconds;

  function maybeCall(...args: T[]) {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      if (Date.now() - lastInvocation < miliseconds) {
        maybeCall(...args);
        return;
      }

      fn(...args);
      lastInvocation = Date.now();
    }, miliseconds);
  }

  return maybeCall;
}

export function filterNullishMap<T, R>(
  arr: T[],
  fn: (item: T, index: number, arr: T[]) => R | null | undefined
): R[] {
  const result: R[] = [];

  for (let i = 0; i < arr.length; i++) {
    const item = fn(arr[i], i, arr);
    if (item !== null && item !== undefined) {
      result.push(item);
    }
  }

  return result;
}
