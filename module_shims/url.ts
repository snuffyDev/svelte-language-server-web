const pathToFileURL = (surl: string) => {
  return new URL(surl, "file:");
};

const _URL = URL;
export { _URL as URL, pathToFileURL };

export default { URL, pathToFileURL };
