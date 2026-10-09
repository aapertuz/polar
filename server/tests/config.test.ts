import assert from "node:assert/strict";
import test from "node:test";
import { getServerConfig } from "../src/config.js";
import { environmentTargets, getDatabaseConfig } from "../src/environment.js";

const validEnvironment: NodeJS.ProcessEnv = {
  POLAR_ENV: "development",
  NEON_BRANCH: "development",
  DATABASE_URL: `postgresql://polar:secret@${environmentTargets.development.databaseHost}/${environmentTargets.development.databaseName}?sslmode=require`,
  BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-32-chars",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  POLAR_DESKTOP_CLIENT_ID: "com.polar.desktop",
};

test("server config validates identity and database inputs", () => {
  assert.deepEqual(getServerConfig(validEnvironment), {
    environment: "development",
    host: "127.0.0.1",
    port: 3000,
    databaseUrl: validEnvironment.DATABASE_URL,
    betterAuthSecret: validEnvironment.BETTER_AUTH_SECRET,
    betterAuthUrl: validEnvironment.BETTER_AUTH_URL,
    desktopClientId: validEnvironment.POLAR_DESKTOP_CLIENT_ID,
    inngestEventKey: undefined,
    inngestSigningKey: undefined,
  });
  assert.deepEqual(getServerConfig({ ...validEnvironment, HOST: "0.0.0.0", PORT: "8080" }), {
    environment: "development",
    host: "0.0.0.0",
    port: 8080,
    databaseUrl: validEnvironment.DATABASE_URL,
    betterAuthSecret: validEnvironment.BETTER_AUTH_SECRET,
    betterAuthUrl: validEnvironment.BETTER_AUTH_URL,
    desktopClientId: validEnvironment.POLAR_DESKTOP_CLIENT_ID,
    inngestEventKey: undefined,
    inngestSigningKey: undefined,
  });
});

test("server config rejects malformed ports", () => {
  for (const PORT of ["", " ", "abc", "3.5", "0", "65536", "-1"]) {
    assert.throws(() => getServerConfig({ ...validEnvironment, PORT }), /PORT/);
  }
});

test("server config rejects missing and malformed required inputs", () => {
  for (const key of [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "POLAR_DESKTOP_CLIENT_ID",
  ] as const) {
    const env = { ...validEnvironment };
    delete env[key];
    assert.throws(() => getServerConfig(env), new RegExp(key));
  }
  assert.throws(
    () => getServerConfig({ ...validEnvironment, DATABASE_URL: "https://invalid.test" }),
    /DATABASE_URL/,
  );
  assert.throws(
    () => getServerConfig({ ...validEnvironment, BETTER_AUTH_SECRET: "short" }),
    /BETTER_AUTH_SECRET/,
  );
  assert.throws(
    () =>
      getServerConfig({
        ...validEnvironment,
        BETTER_AUTH_URL: "https://user:pass@example.test/path",
      }),
    /BETTER_AUTH_URL/,
  );
  assert.throws(
    () =>
      getServerConfig({
        ...validEnvironment,
        POLAR_ENV: "production",
        NEON_BRANCH: "production",
        DATABASE_URL: `postgresql://polar:secret@${environmentTargets.production.databaseHost}/${environmentTargets.production.databaseName}?sslmode=require`,
      }),
    /HTTPS/,
  );
});

test("development rejects production endpoints, branch labels, and unscoped configuration", () => {
  assert.throws(() => getServerConfig({ ...validEnvironment, POLAR_ENV: undefined }), /POLAR_ENV/);
  assert.throws(() => getServerConfig({ ...validEnvironment, POLAR_ENV: "staging" }), /POLAR_ENV/);
  assert.throws(
    () => getServerConfig({ ...validEnvironment, NEON_BRANCH: "production" }),
    /NEON_BRANCH/,
  );
  assert.throws(
    () =>
      getServerConfig({
        ...validEnvironment,
        DATABASE_URL: `postgresql://polar:secret@${environmentTargets.production.databaseHost}/${environmentTargets.production.databaseName}?sslmode=require`,
      }),
    /development Neon endpoint/,
  );
  assert.throws(
    () =>
      getServerConfig({
        ...validEnvironment,
        DATABASE_URL: validEnvironment.DATABASE_URL!.replace("?sslmode=require", ""),
      }),
    /TLS/,
  );
});

test("tests cannot authenticate or migrate using production configuration", () => {
  const production = {
    ...validEnvironment,
    NODE_ENV: "test",
    POLAR_ENV: "production",
    NEON_BRANCH: "production",
  };
  assert.throws(() => getServerConfig(production), /Tests must use/);
  assert.throws(() => getDatabaseConfig(production, true), /Tests must use/);
});

test("migrations require the selected environment's direct endpoint with no fallback", () => {
  assert.throws(() => getDatabaseConfig(validEnvironment, true), /DATABASE_URL_UNPOOLED/);
  const direct = { ...validEnvironment, DATABASE_URL_UNPOOLED: validEnvironment.DATABASE_URL };
  assert.equal(getDatabaseConfig(direct, true).databaseUrl, validEnvironment.DATABASE_URL);
  assert.throws(
    () =>
      getDatabaseConfig(
        {
          ...direct,
          DATABASE_URL_UNPOOLED: direct.DATABASE_URL_UNPOOLED!.replace(".c-7", "-pooler.c-7"),
        },
        true,
      ),
    /direct Neon endpoint/,
  );
  assert.throws(
    () =>
      getDatabaseConfig(
        {
          ...direct,
          DATABASE_URL_UNPOOLED: direct.DATABASE_URL_UNPOOLED!.replace(
            environmentTargets.development.databaseHost,
            environmentTargets.production.databaseHost,
          ),
        },
        true,
      ),
    /development Neon endpoint/,
  );
});

test("production requires explicit matching database and HTTPS authentication settings", () => {
  const production = {
    ...validEnvironment,
    NODE_ENV: "production",
    POLAR_ENV: "production",
    NEON_BRANCH: "production",
    DATABASE_URL: `postgresql://polar:secret@${environmentTargets.production.databaseHost}/${environmentTargets.production.databaseName}?sslmode=require`,
    BETTER_AUTH_URL: "https://polar.example.test",
    INNGEST_EVENT_KEY: "event-key",
    INNGEST_SIGNING_KEY: "signing-key",
  };
  assert.equal(getServerConfig(production).environment, "production");
  assert.throws(
    () => getServerConfig({ ...production, INNGEST_EVENT_KEY: undefined }),
    /INNGEST_EVENT_KEY/,
  );
  assert.throws(
    () => getServerConfig({ ...production, NEON_BRANCH: "development" }),
    /NEON_BRANCH/,
  );
  assert.throws(() => getServerConfig({ ...validEnvironment, NODE_ENV: "production" }), /NODE_ENV/);
});
