function extractKitProperty(objString: string): string | null {
  const kitMatch = objString.match(/kit\s*:\s*{[^]*?}\s*,?/);
  return kitMatch ? kitMatch[0] : null;
}

function addKitToDefaultExport(baseModule: string, kitString: string): string {
  const closingBracePosition = baseModule.lastIndexOf("}");

  if (closingBracePosition === -1) {
    throw new Error(
      "Base module does not have a closing brace for the default export object"
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
