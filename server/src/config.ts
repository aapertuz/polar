import { getDatabaseConfig, type Environment } from "./environment.js";

export interface ServerConfig {
  environment: Environment;
  host: string;
  port: number;
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  desktopClientId: string;
}

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.HOST === undefined ? "127.0.0.1" : env.HOST.trim();
  if (!host) {
    throw new Error("HOST must not be empty.");
  }

  const rawPort = env.PORT === undefined ? "3000" : env.PORT;
  if (!/^\d+$/.test(rawPort)) {
    throw new Error("PORT must be a whole number between 1 and 65535.");
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a whole number between 1 and 65535.");
  }

  const { environment, databaseUrl } = getDatabaseConfig(env);

  const betterAuthSecret = required(env, "BETTER_AUTH_SECRET");
  if (betterAuthSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  const betterAuthUrl = required(env, "BETTER_AUTH_URL");
  let parsedAuthUrl: URL;
  try {
    parsedAuthUrl = new URL(betterAuthUrl);
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute HTTP or HTTPS URL.");
  }
  if (
    !["http:", "https:"].includes(parsedAuthUrl.protocol) ||
    parsedAuthUrl.username ||
    parsedAuthUrl.password ||
    parsedAuthUrl.pathname !== "/" ||
    parsedAuthUrl.search ||
    parsedAuthUrl.hash
  ) {
    throw new Error("BETTER_AUTH_URL must be an origin without credentials or a path.");
  }
  if (environment === "production" && parsedAuthUrl.protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }

  const desktopClientId = required(env, "POLAR_DESKTOP_CLIENT_ID");
  if (!/^[a-zA-Z0-9._:-]{3,100}$/.test(desktopClientId)) {
    throw new Error("POLAR_DESKTOP_CLIENT_ID must be a valid public client identifier.");
  }

  return { environment, host, port, databaseUrl, betterAuthSecret, betterAuthUrl, desktopClientId };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
}
