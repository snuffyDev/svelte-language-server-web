export let process = new Proxy(
	{
		env: {
			DEBUG: "",
		},
		cwd: () => "/",
	},
	{
		get: (target, prop, receiver) => {
			if (prop === "STYLUS_COV") return false;
			const hasProp = Reflect.has(target, prop);
			if (!hasProp) {
				// console.log(target, prop, receiver);
				Reflect.set(target, prop, "", receiver);
				return Reflect.get(target, prop);
			}
			return Reflect.get(target, prop);
		},
	},
);
export default process;
