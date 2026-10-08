import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { acquireLease, classify } from "./native-dev.mjs";

test("instance classification distinguishes reusable development from missing parts and foreign listeners", () => {
  assert.equal(classify({}), "stopped");
  assert.equal(classify({ occupied: true }), "port-conflict");
  assert.equal(classify({ occupied: true, native: true }), "port-conflict");
  assert.equal(classify({ occupied: true, server: true }), "vite-only");
  assert.equal(classify({ native: true }), "native-only");
  assert.equal(classify({ server: true, native: true }), "ready");
  assert.equal(classify({ launcher: true }), "starting");
  assert.equal(classify({ server: true, watcher: true }), "starting");
});

test("launch ownership rejects a second starter and recovers a dead owner's lease", () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-dev-lease-"));
  const path = join(directory, "session.json");
  try {
    assert.equal(
      acquireLease(path, { pid: 100 }, () => true),
      true,
    );
    assert.equal(
      acquireLease(path, { pid: 101 }, () => true),
      false,
    );
    assert.equal(JSON.parse(readFileSync(path)).pid, 100);
    assert.equal(
      acquireLease(path, { pid: 101 }, () => false),
      true,
    );
    assert.equal(JSON.parse(readFileSync(path)).pid, 101);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("incomplete ownership and concurrent recovery fail closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-dev-lease-"));
  const path = join(directory, "session.json");
  try {
    writeFileSync(path, "");
    assert.equal(
      acquireLease(path, { pid: 101 }, () => false),
      false,
    );
    assert.equal(readFileSync(path, "utf8"), "");
    mkdirSync(`${path}.guard`);
    assert.equal(
      acquireLease(path, { pid: 102 }, () => false),
      false,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cargo runner exec preserves native PID and arguments, including paths with spaces", async () => {
  const directory = mkdtempSync(join(tmpdir(), "polar runner "));
  try {
    const binary = join(directory, "fake app");
    const record = join(directory, "prepared.json");
    const runner = join(directory, "runner.sh");
    copyFileSync(new URL("./native-dev-runner.sh", import.meta.url), runner);
    writeFileSync(
      join(directory, "native-dev.mjs"),
      `
      import { writeFileSync } from "node:fs";
      writeFileSync(${JSON.stringify(record)}, JSON.stringify({ binary: process.argv[3], pid: Number(process.argv[4]) }));
      console.log(${JSON.stringify(binary)});
    `,
    );
    writeFileSync(binary, '#!/bin/sh\nprintf "%s\\n" "$$" "$@"\n', { mode: 0o700 });
    const child = spawn("/bin/sh", [runner, "source binary", "argument with spaces"], {
      env: { ...process.env, POLAR_DEV_NODE: process.execPath },
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    await new Promise((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? resolveExit() : reject(new Error(`Runner exit ${code}`)),
      );
    });
    assert.deepEqual(JSON.parse(readFileSync(record)), { binary: "source binary", pid: child.pid });
    assert.equal(output, `${child.pid}\nargument with spaces\n`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("concurrent starters recover a stale lease with exactly one winner", async () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-dev-race-"));
  const path = join(directory, "session.json");
  try {
    writeFileSync(path, JSON.stringify({ pid: 77 }));
    const worker = join(directory, "claim.mjs");
    writeFileSync(
      worker,
      `
      import { acquireLease } from ${JSON.stringify(new URL("./native-dev.mjs", import.meta.url).href)};
      console.log(acquireLease(${JSON.stringify(path)}, { pid: process.pid }, (pid) => pid !== 77));
    `,
    );
    const results = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          new Promise((resolveExit, reject) => {
            const child = spawn(process.execPath, [worker]);
            let output = "";
            child.stdout.on("data", (chunk) => {
              output += chunk;
            });
            child.once("error", reject);
            child.once("exit", (code) =>
              code === 0
                ? resolveExit(output.trim())
                : reject(new Error(`Claim worker exit ${code}`)),
            );
          }),
      ),
    );
    assert.equal(results.filter((value) => value === "true").length, 1);
    assert.equal(results.filter((value) => value === "false").length, 7);
    assert.notEqual(JSON.parse(readFileSync(path)).pid, 77);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
