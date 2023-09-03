export function add(a: number, b: number) {
	return a + b;
}

export function addFor(base: number, ...args: number[]) {
	let sum = base;
	for (const arg of args) {
		sum += arg;
	}
	return add(base, sum);
}
