export const setupDocument = (
	files: Record<string, string>,
	handleSelect: (oldPath: string, newPath: string) => void,
) => {
	const sectionDiv = document.createElement("div");
	const nav = document.querySelector("nav")!;

	let oldPath = "";

	for (const path of Object.keys(files)) {
		if (path.includes("node_modules")) continue;
		const clone = sectionDiv.cloneNode();
		const button = document.createElement("button");

		button.innerText = path;
		button.addEventListener("click", () => {
			handleSelect(oldPath, path);
			oldPath = path;
		});
		clone.appendChild(button);
		clone.classList.add("nav-item");
		nav.appendChild(clone);
	}
};
