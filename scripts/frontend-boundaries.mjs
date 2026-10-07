import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
export const ts = createRequire(new URL("../native/package.json", import.meta.url))("typescript");
export function sourceImports(file, text) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return ast.statements.flatMap((node) =>
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
      ? [node.moduleSpecifier.text]
      : [],
  );
}
export function checkBoundaries(file, text, root) {
  const owner = relative(root, file).replaceAll("\\", "/");
  return sourceImports(file, text).flatMap((specifier) => {
    const target = specifier.startsWith("@/")
      ? specifier.slice(2)
      : specifier.startsWith(".")
        ? relative(root, resolve(dirname(file), specifier)).replaceAll("\\", "/")
        : null;
    if (!target) return [];
    if (owner.startsWith("components/") && /^(features|pages)\//.test(target))
      return [`${owner} imports ${target}`];
    if (
      owner.startsWith("features/") &&
      (target.startsWith("pages/") ||
        (target.startsWith("features/") && target.split("/")[1] !== owner.split("/")[1]))
    )
      return [`${owner} imports ${target}`];
    return [];
  });
}
