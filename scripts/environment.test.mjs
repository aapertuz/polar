import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  desktopDevelopmentEnvironment,
  desktopProductionEnvironment,
  loadEnvironment,
} from "./environment.mjs";

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

test("desktop production builds use public configuration and discard inherited server and Apple credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-desktop-production-"));
  try {
    mkdirSync(join(directory, "native"));
    writeFileSync(
      join(directory, "native/production.json"),
      JSON.stringify({
        apiBaseUrl: "https://polar.example.test",
        desktopClientId: "com.example.polar",
      }),
    );
    // A desktop-only build must not parse or depend on either server credential file.
    writeFileSync(join(directory, ".env.production.local"), "POLAR_ENV=development\n");
    writeFileSync(join(directory, ".env.development.local"), "BETTER_AUTH_SECRET=file-secret\n");
    const inherited = {
      PATH: "/bin",
      POLAR_ENV: "development",
      NODE_ENV: "test",
      POLAR_API_BASE_URL: "http://localhost:3000",
      POLAR_DESKTOP_CLIENT_ID: "com.example.polar.development",
      DATABASE_URL: "ambient-db",
      DATABASE_URL_UNPOOLED: "ambient-direct",
      BETTER_AUTH_SECRET: "ambient-secret",
      INNGEST_EVENT_KEY: "ambient-event",
      INNGEST_SIGNING_KEY: "ambient-signing",
      APPLE_ID: "ambient-apple-id",
      APPLE_PASSWORD: "ambient-apple-password",
      APPLE_CERTIFICATE: "ambient-certificate",
      APPLE_SIGNING_IDENTITY: "Developer ID Application",
    };
    const result = desktopProductionEnvironment(inherited, directory);
    assert.equal(result.POLAR_ENV, "production");
    assert.equal(result.NODE_ENV, "production");
    assert.equal(result.POLAR_API_BASE_URL, "https://polar.example.test");
    assert.equal(result.POLAR_DESKTOP_CLIENT_ID, "com.example.polar");
    assert.equal(result.APPLE_SIGNING_IDENTITY, "-");
    assert.equal(result.PATH, "/bin");
    for (const key of [
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "BETTER_AUTH_SECRET",
      "INNGEST_EVENT_KEY",
      "INNGEST_SIGNING_KEY",
      "APPLE_ID",
      "APPLE_PASSWORD",
      "APPLE_CERTIFICATE",
    ])
      assert.equal(result[key], undefined, key);
    assert.equal(inherited.POLAR_ENV, "development");
    assert.equal(inherited.BETTER_AUTH_SECRET, "ambient-secret");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("desktop production configuration rejects insecure origins and invalid client identities before building", () => {
  const directory = mkdtempSync(join(tmpdir(), "polar-desktop-production-"));
  try {
    mkdirSync(join(directory, "native"));
    for (const apiBaseUrl of [
      "http://polar.example.test",
      "https://user:password@polar.example.test",
      "https://polar.example.test/api/auth",
      "https://polar.example.test?secret=value",
      "https://polar.example.test#fragment",
    ]) {
      writeFileSync(
        join(directory, "native/production.json"),
        JSON.stringify({ apiBaseUrl, desktopClientId: "com.example.polar" }),
      );
      assert.throws(() => desktopProductionEnvironment({}, directory), /HTTPS origin/);
    }
    writeFileSync(
      join(directory, "native/production.json"),
      JSON.stringify({
        apiBaseUrl: "https://polar.example.test",
        desktopClientId: "invalid client",
      }),
    );
    assert.throws(() => desktopProductionEnvironment({}, directory), /public client identifier/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
