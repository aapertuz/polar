import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ts } from "../../scripts/frontend-boundaries.mjs";
const root = fileURLToPath(new URL("../src/", import.meta.url));
const overlayTypes = readFileSync(resolve(root, "components/ui/overlay.types.ts"), "utf8");
const registryFile = resolve(root, "pages/home/config/overlayRegistry.ts");
const registry = readFileSync(registryFile, "utf8");
test("overlay registry covers every overlay kind with a component file", () => {
  const overlayTypeSource = ts.createSourceFile(
    "overlay.types.ts",
    overlayTypes,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const overlayKind = overlayTypeSource.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "OverlayKind",
  );
  assert.ok(overlayKind && ts.isUnionTypeNode(overlayKind.type));
  const kinds = overlayKind.type.types.map((member) => {
    assert.ok(ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal));
    return member.literal.text;
  });
  const source = ts.createSourceFile(
    registryFile,
    registry,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const record = source.statements.find(ts.isVariableStatement)?.declarationList.declarations[0]
    .initializer;
  assert.ok(record && ts.isObjectLiteralExpression(record));
  const registryObject = record;
  assert.ok(ts.isObjectLiteralExpression(registryObject));
  const keys = registryObject.properties.map((property) =>
    property.name?.getText(source).replaceAll('"', ""),
  );
  assert.deepEqual(keys, kinds);
  for (const match of registry.matchAll(
    /import \{ (\w+) \} from "@\/pages\/home\/components\/overlays\/(\w+)"/g,
  )) {
    assert.equal(match[1], match[2]);
    assert.ok(existsSync(resolve(root, "pages/home/components/overlays/" + match[2] + ".tsx")));
  }
  assert.match(registry, /Record<OverlayKind, OverlayDefinition>/);
  assert.ok(
    registryObject.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        ts.isObjectLiteralExpression(property.initializer) &&
        property.initializer.properties.some(
          (entry) => ts.isPropertyAssignment(entry) && entry.name.getText(source) === "Component",
        ),
    ),
  );
});
