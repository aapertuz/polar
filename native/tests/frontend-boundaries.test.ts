import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../src/", import.meta.url));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

test("shared UI does not import features or page composition", () => {
  for (const file of files(join(source, "components"))) {
    for (const match of readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const target = relative(source, resolve(dirname(file), match[1]));
      assert.ok(!/^(features|pages)\//.test(target), `${relative(source, file)} imports ${target}`);
    }
  }
});

test("features do not import pages or other feature internals", () => {
  for (const file of files(join(source, "features"))) {
    const feature = relative(source, file).split("/")[1];
    for (const match of readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const target = relative(source, resolve(dirname(file), match[1]));
      assert.ok(!target.startsWith("pages/"), `${file} imports page ${target}`);
      if (target.startsWith("features/"))
        assert.equal(target.split("/")[1], feature, `${file} imports another feature`);
    }
  }
});
