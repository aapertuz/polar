import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBoundaries } from "../../scripts/frontend-boundaries.mjs";
const source = fileURLToPath(new URL("../src/", import.meta.url));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
test("frontend dependencies respect shared and feature boundaries", () => {
  for (const file of files(source))
    assert.deepEqual(checkBoundaries(file, readFileSync(file, "utf8"), source), []);
});
test("aliases, relative imports, side effects and re-exports preserve boundary checks", () => {
  for (const statement of [
    'import "@/pages/home/HomeScreen";',
    'export { HomeScreen } from "@/pages/home/HomeScreen";',
    'import { HomeScreen } from "../../../pages/home/HomeScreen";',
  ]) {
    assert.equal(
      checkBoundaries(join(source, "features/missions/components/Example.tsx"), statement, source)
        .length,
      1,
    );
  }
  assert.equal(
    checkBoundaries(
      join(source, "components/ui/Example.tsx"),
      'import "@/features/missions/types/mission.types";',
      source,
    ).length,
    1,
  );
  assert.equal(
    checkBoundaries(
      join(source, "features/missions/Example.tsx"),
      'export * from "@/features/attention/types/timeline.types";',
      source,
    ).length,
    1,
  );
  assert.deepEqual(
    checkBoundaries(
      join(source, "features/missions/Example.tsx"),
      'import "react"; export * from "@/components/ui/Icon";',
      source,
    ),
    [],
  );
});
