import { readFileSync } from "node:fs";

export type Environment = "development" | "production";

// Public endpoint identities, never credentials. Shared by source and built server.
export const environmentTargets = JSON.parse(
  readFileSync(new URL("../environments.json", import.meta.url), "utf8"),
) as Record<Environment, { branch: string; databaseHost: string; databaseName: string }>;

export function getEnvironment(env: NodeJS.ProcessEnv): Environment {
  const environment = env.POLAR_ENV;
  if (environment !== "development" && environment !== "production") {
    throw new Error("POLAR_ENV must be development or production.");
  }
  if (env.NODE_ENV === "test" && environment !== "development") {
    throw new Error("Tests must use the development environment.");
  }
  if (env.NODE_ENV === "production" && environment !== "production") {
    throw new Error("NODE_ENV production requires POLAR_ENV production.");
  }
  return environment;
}

export function getDatabaseConfig(env: NodeJS.ProcessEnv, migration = false) {
  const environment = getEnvironment(env);
  const target = environmentTargets[environment];
  if (env.NEON_BRANCH !== target.branch) {
    throw new Error(`NEON_BRANCH must match the ${environment} environment.`);
  }
  const name = migration ? "DATABASE_URL_UNPOOLED" : "DATABASE_URL";
  const connectionString = env[name]?.trim();
  let url: URL;
  try {
    url = new URL(connectionString ?? "");
  } catch {
    throw new Error(`${name} must be a PostgreSQL connection URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${name} must be a PostgreSQL connection URL.`);
  }
  const directHost = url.hostname.replace(/-pooler(?=\.)/, "");
  if (directHost !== target.databaseHost) {
    throw new Error(`${name} must target the configured ${environment} Neon endpoint.`);
  }
  if (decodeURIComponent(url.pathname) !== `/${target.databaseName}`) {
    throw new Error(`${name} must target the configured ${environment} database name.`);
  }
  if (migration && url.hostname !== directHost) {
    throw new Error("DATABASE_URL_UNPOOLED must use the direct Neon endpoint.");
  }
  if (
    url.searchParams.get("sslmode") !== "require" &&
    url.searchParams.get("sslmode") !== "verify-full"
  ) {
    throw new Error(`${name} must require TLS.`);
  }
  return { environment, databaseUrl: connectionString! };
}
