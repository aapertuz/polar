import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { desktopDevelopmentEnvironment, loadEnvironment } from "./environment.mjs";

test("local commands replace inherited production credentials with the scoped development file", () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-environments-"));
  try {
    writeFileSync(join(directory, ".env.local"), "DATABASE_URL=legacy-production\n");
    writeFileSync(
      join(directory, ".env.development.local"),
      "DATABASE_URL=development-db\nNEON_BRANCH=development\nBETTER_AUTH_SECRET=development-secret\nBETTER_AUTH_URL=http://127.0.0.1:3000\n",
    );
    writeFileSync(
      join(directory, ".env.production.local"),
      "DATABASE_URL=production-db\nBETTER_AUTH_SECRET=production-secret\n",
    );
    const inherited = {
      DATABASE_URL: "ambient-production",
      DATABASE_URL_UNPOOLED: "ambient-direct",
      POLAR_ENV: "production",
      BETTER_AUTH_SECRET: "ambient-secret",
      PATH: "/bin",
    };
    const dev = loadEnvironment("development", inherited, directory);
    assert.equal(dev.DATABASE_URL, "development-db");
    assert.equal(dev.DATABASE_URL_UNPOOLED, undefined);
    assert.equal(dev.BETTER_AUTH_SECRET, "development-secret");
    assert.equal(dev.POLAR_ENV, "development");
    assert.equal(dev.PATH, "/bin");
    const production = loadEnvironment("production", inherited, directory);
    assert.equal(production.DATABASE_URL, "production-db");
    assert.equal(production.NODE_ENV, "production");
    const live = loadEnvironment("integration", inherited, directory);
    assert.equal(live.DATABASE_URL, "development-db");
    assert.equal(live.NODE_ENV, "test");
    const unit = loadEnvironment("test", inherited, directory);
    assert.equal(unit.DATABASE_URL, undefined);
    assert.equal(unit.BETTER_AUTH_SECRET, undefined);
    assert.equal(unit.NODE_ENV, "test");
    const desktop = desktopDevelopmentEnvironment(
      { ...inherited, POLAR_API_BASE_URL: "https://production.example.test" },
      directory,
    );
    assert.equal(desktop.POLAR_API_BASE_URL, "http://127.0.0.1:3000");
    assert.equal(desktop.DATABASE_URL, undefined);
    assert.equal(desktop.BETTER_AUTH_SECRET, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing development file never falls back to production or legacy credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-environments-"));
  try {
    writeFileSync(join(directory, ".env.local"), "DATABASE_URL=legacy-production\n");
    const dev = loadEnvironment(
      "development",
      { DATABASE_URL: "production-db", NEON_BRANCH: "production" },
      directory,
    );
    assert.equal(dev.DATABASE_URL, undefined);
    const shell = loadEnvironment(
      "development",
      { POLAR_ENV: "development", NEON_BRANCH: "development", DATABASE_URL: "explicit-db" },
      directory,
    );
    assert.equal(shell.DATABASE_URL, "explicit-db");
    assert.throws(() => loadEnvironment("staging", {}, directory), /environment mode/);
    writeFileSync(join(directory, ".env.development.local"), "POLAR_ENV=production\n");
    assert.throws(() => loadEnvironment("development", {}, directory), /does not match/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
