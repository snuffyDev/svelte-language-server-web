import * as ts from "typescript";

declare global {
	interface Window {
		typescript$1: typeof ts;
	}
	var _self: Window;
}
