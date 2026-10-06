import assert from "node:assert/strict";
import test from "node:test";
import { getServerConfig } from "../src/config.js";

test("server config uses local defaults and accepts valid overrides", () => {
  assert.deepEqual(getServerConfig({}), { host: "127.0.0.1", port: 3000 });
  assert.deepEqual(getServerConfig({ HOST: "0.0.0.0", PORT: "8080" }), {
    host: "0.0.0.0",
    port: 8080,
  });
});

test("server config rejects empty, malformed, fractional, and out-of-range ports", () => {
  for (const PORT of ["", " ", "abc", "3.5", "0", "65536", "-1"]) {
    assert.throws(() => getServerConfig({ PORT }), /PORT/);
  }
});

test("server config rejects an empty host", () => {
  assert.throws(() => getServerConfig({ HOST: " " }), /HOST/);
});
