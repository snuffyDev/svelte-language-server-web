const pathToFileURL = (surl: string) => {
  return new URL(surl, "file:");
};

export default {
  URL,
  pathToFileURL,
};

const _url = URL;

export { _url as URL, pathToFileURL };
