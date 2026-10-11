import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const detail = readFileSync(
  resolve(sourceRoot, "features/missions/components/ActionDetail.tsx"),
  "utf8",
);
const hook = readFileSync(
  resolve(sourceRoot, "features/missions/hooks/useActionDetail.ts"),
  "utf8",
);

test("written results use the conversation while links and documents submit as evidence", () => {
  assert.match(detail, /Message or written result/);
  assert.doesNotMatch(detail, /<label htmlFor="action-evidence">Evidence or result<\/label>/);
  assert.doesNotMatch(detail, /id="action-evidence"/);
  assert.match(detail, /type="url"[\s\S]*?required/);
  assert.match(detail, /Submit link/);
  assert.match(hook, /kind: "reference",\s*content: url,\s*referenceUrl: url/);
  assert.match(hook, /kind: "document"/);
});
