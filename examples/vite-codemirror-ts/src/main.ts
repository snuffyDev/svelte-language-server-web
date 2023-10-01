import "./style.css";

import projectRaw from "./../../../project.json";
import { setupEditor } from "./editor";

const project = Object.fromEntries(
  Object.entries(projectRaw).map(([key, value]) => [key, unescape(value)])
);

const init_files = {
  "file:///package.json": project["/package.json"],
  ...Object.fromEntries(
    Object.entries(project).map(([key, value]) => [`file://${key}`, value])
  ),
};

const main = async () => {
  await setupEditor({
    document_uri: "file:///src/routes/+page.svelte",
    code: project["/src/routes/+page.svelte"],
    files: init_files,
  });
};

main();
