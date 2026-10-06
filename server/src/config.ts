export interface ServerConfig {
  host: string;
  port: number;
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

  return { host, port };
}
