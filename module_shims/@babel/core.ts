import { SourceMapConsumer, SourceMapGenerator } from "source-map-js";
// babel polyfill
export const babel = {
  transformAsync: (code: string, options: any) => {
    const sourceMap = new SourceMapConsumer({
      version: "0",
      mappings: "",
      names: [""],
      file: code,
      sourcesContent: [code],
      sources: [code],
    });
    return {
      code,
      map: SourceMapGenerator.fromSourceMap(sourceMap).toString(),
    };
  },
};
