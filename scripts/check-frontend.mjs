import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ts, sourceImports } from "./frontend-boundaries.mjs";
const root = fileURLToPath(new URL("../native/src/", import.meta.url));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(tsx?|css)$/.test(path) ? [path] : [];
  });
}
export function analyze(file, text) {
  const issues = [];
  const ast = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const report = (node, message) => {
    const pos = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    issues.push(`${relative(root, file)}:${pos.line + 1}:${pos.character + 1} ${message}`);
  };
  const baseHooks = new Set([
    "useState",
    "useEffect",
    "useLayoutEffect",
    "useInsertionEffect",
    "useRef",
    "useReducer",
    "useCallback",
    "useMemo",
    "useContext",
    "useId",
    "useImperativeHandle",
    "useSyncExternalStore",
    "useReducedMotion",
    "useIsPresent",
    "useDragControls",
    "useMotionValue",
  ]);
  const hookAliases = new Map();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        const imported = specifier.propertyName?.text ?? specifier.name.text;
        if (imported.startsWith("use")) hookAliases.set(specifier.name.text, imported);
      }
    }
  }
  const hookName = (expression) => {
    if (ts.isIdentifier(expression)) return hookAliases.get(expression.text) ?? expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return "";
  };
  const hasJsx = (node) => {
    let found = false;
    const inspect = (child) => {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child))
        found = true;
      if (!found) ts.forEachChild(child, inspect);
    };
    inspect(node);
    return found;
  };
  function checkComponentHooks(node) {
    if (
      !(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))
    )
      return;
    const name =
      node.name?.text ??
      (node.parent && ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(ast) : "");
    if (!/^[A-Z]/.test(name) || !node.body) return;
    let masterHooks = 0;
    const inspect = (child) => {
      if (ts.isCallExpression(child)) {
        const canonical = hookName(child.expression);
        if (baseHooks.has(canonical))
          report(
            child,
            `Call ${canonical} through one focused master hook instead of inside a component.`,
          );
        else if (/^use[A-Z]/.test(canonical)) masterHooks += 1;
      }
      ts.forEachChild(child, inspect);
    };
    inspect(node.body);
    if (masterHooks > 1)
      report(node, "Compose behavioral hooks behind one master hook for this component.");
  }
  for (const spec of sourceImports(file, text))
    if (spec.startsWith(".")) {
      const owner = ast.statements.find((node) => node.getText(ast).includes(spec)) ?? ast;
      report(owner, `Use an @/ alias for application-local imports (${spec}).`);
    }
  function visit(node) {
    checkComponentHooks(node);
    if (
      ts.isJsxAttribute(node) &&
      (/^on[A-Z]/.test(node.name.getText(ast)) || node.name.getText(ast) === "ref") &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isArrowFunction(node.initializer.expression)
    )
      report(node, "Use a named handler or ref callback; move interaction logic outside JSX.");
    if (ts.isSwitchStatement(node)) {
      if (node.expression.getText(ast) === "request.kind")
        report(node, "Select overlay component references through overlayRegistry.");
      const containsReturnedJsx = (child) => {
        if (child !== node && ts.isSwitchStatement(child)) return false;
        if (ts.isReturnStatement(child) && child.expression && hasJsx(child.expression))
          return true;
        return child.getChildren(ast).some(containsReturnedJsx);
      };
      if (containsReturnedJsx(node.caseBlock))
        report(
          node,
          "Select rendered components through a typed registry instead of a JSX-returning switch.",
        );
    }
    if (ts.isCallExpression(node)) {
      let expression = node.expression;
      while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression))
        expression = expression.expression;
      if (
        (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) &&
        hasJsx(expression.body)
      )
        report(node, "Do not render components through an immediately invoked expression.");
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return issues;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = files(root).flatMap((file) => analyze(file, readFileSync(file, "utf8")));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else console.log(`Frontend conventions passed (${files(root).length} source files).`);
}
