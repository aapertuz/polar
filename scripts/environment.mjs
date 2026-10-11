import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scopedKeys = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "NEON_BRANCH",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_JWKS_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "POLAR_API_BASE_URL",
  "POLAR_DESKTOP_CLIENT_ID",
  "HOST",
  "PORT",
];

export function loadEnvironment(mode, inherited = process.env, directory = root) {
  if (!["development", "production", "test", "integration"].includes(mode)) {
    throw new Error("Expected development, production, test, or integration environment mode.");
  }
  const environment = mode === "production" ? "production" : "development";
  const result = { ...inherited };
  const file = join(directory, `.env.${environment}.local`);
  const isUnitTest = mode === "test";
  // Unit tests never inherit real credentials or load an environment file.
  if (isUnitTest || existsSync(file)) {
    for (const key of scopedKeys) delete result[key];
    if (!isUnitTest) {
      const values = parseEnv(readFileSync(file, "utf8"));
      if (values.POLAR_ENV && values.POLAR_ENV !== environment) {
        throw new Error(`POLAR_ENV in ${file} does not match ${environment}.`);
      }
      for (const key of scopedKeys) if (values[key] !== undefined) result[key] = values[key];
    }
  } else if (inherited.POLAR_ENV !== environment) {
    // An unscoped shell or old .env.local must never supply a development DB.
    for (const key of scopedKeys) delete result[key];
  }
  result.POLAR_ENV = environment;
  result.NODE_ENV = isUnitTest || mode === "integration" ? "test" : environment;
  return result;
}

export function desktopDevelopmentEnvironment(inherited = process.env, directory = root) {
  const selected = loadEnvironment("development", inherited, directory);
  const result = { ...inherited };
  for (const key of scopedKeys) delete result[key];
  result.POLAR_ENV = "development";
  result.POLAR_API_BASE_URL = selected.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
  result.POLAR_DESKTOP_CLIENT_ID =
    selected.POLAR_DESKTOP_CLIENT_ID ?? "com.antoniopertuz.polar.desktop.development";
  return result;
}

export function desktopProductionEnvironment(inherited = process.env, directory = root) {
  const config = JSON.parse(readFileSync(join(directory, "native/production.json"), "utf8"));
  const url = new URL(config.apiBaseUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Desktop production apiBaseUrl must be a public HTTPS origin.");
  }
  if (
    typeof config.desktopClientId !== "string" ||
    !/^[a-zA-Z0-9._:-]{3,100}$/.test(config.desktopClientId)
  ) {
    throw new Error("Desktop production desktopClientId must be a valid public client identifier.");
  }
  const result = { ...inherited };
  for (const key of [
    ...scopedKeys,
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_TEAM_ID",
    "APPLE_API_KEY",
    "APPLE_API_ISSUER",
    "APPLE_API_KEY_PATH",
  ])
    delete result[key];
  result.NODE_ENV = "production";
  result.POLAR_ENV = "production";
  result.POLAR_API_BASE_URL = url.origin;
  result.POLAR_DESKTOP_CLIENT_ID = config.desktopClientId;
  result.APPLE_SIGNING_IDENTITY = "-";
  return result;
}

async function run() {
  const [mode, command, ...args] = process.argv.slice(2);
  if (!command) throw new Error("Usage: environment.mjs <mode> <command> [args...]");
  const child = spawn(command, args, { stdio: "inherit", env: loadEnvironment(mode) });
  process.once("SIGINT", () => child.kill("SIGINT"));
  process.once("SIGTERM", () => child.kill("SIGTERM"));
  await new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
      done();
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
