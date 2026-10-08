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
