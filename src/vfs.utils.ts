export class EitherOr<T, U> {
	constructor(public left: T, public right: U) {}

	public includesStr = (value: unknown): value is T | U => {
		if (typeof value !== "string") return false;

		return (
			value.includes(this.left as unknown as string) ||
			value.includes(this.right as unknown as string)
		);
	};

	public startsWithStr = (value: unknown): value is T | U => {
		if (typeof value !== "string") return false;

		return (
			value.startsWith(this.left as unknown as string) ||
			value.startsWith(this.right as unknown as string)
		);
	};

	public endsWithStr = (value: unknown): value is T | U => {
		if (typeof value !== "string") return false;

		return (
			value.endsWith(this.left as unknown as string) ||
			value.endsWith(this.right as unknown as string)
		);
	};

	public is = (value: unknown): value is T | U => {
		return value === this.left || value === this.right;
	};

	public toLeftStr = (value: unknown): T => {
		if (this.is(value)) return value as T;
		else if (this.includesStr(value)) return this.left;
		else (this.left as string).concat(value as string);
		throw new Error(`Value is not ${this.left}`);
	};

	public toRighttStr = (value: unknown): U => {
		if (this.is(value)) return value as U;
		else if (this.includesStr(value)) return this.right;
		else (this.right as string).concat(value as string);
		throw new Error(`Value is not ${this.right}`);
	};
}

function extractKitProperty(objString: string): string | null {
	const kitMatch = objString.match(/kit\s*:\s*{[^]*?}\s*,?/);
	return kitMatch ? kitMatch[0] : null;
}

function addKitToDefaultExport(baseModule: string, kitString: string): string {
	const closingBracePosition = baseModule.lastIndexOf("}");

	if (closingBracePosition === -1) {
		throw new Error(
			"Base module does not have a closing brace for the default export object",
		);
	}

	const beforeClosingBrace = baseModule
		.substring(0, closingBracePosition)
		.trim();
	const afterClosingBrace = baseModule.substring(closingBracePosition);

	return `${beforeClosingBrace}${
		beforeClosingBrace.endsWith(",") ? "" : ","
	}\n${kitString}\n${afterClosingBrace}`;
}

export { extractKitProperty, addKitToDefaultExport };
