import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { getServerConfig } from "./config.js";
import { createDatabase } from "./db/client.js";

async function startServer(): Promise<void> {
  let app: ReturnType<typeof createApp> | undefined;
  let pool: ReturnType<typeof createDatabase>["pool"] | undefined;
  try {
    const config = getServerConfig();
    const database = createDatabase(config.databaseUrl);
    pool = database.pool;
    const auth = createAuth(database.db, config);
    app = createApp({ auth, db: database.db, config });
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`Server listening at http://${config.host}:${config.port}`);
  } catch (error) {
    app?.log.error({ err: error }, "Server startup failed");
    if (!app)
      process.stderr.write(
        "Server startup failed: check required configuration and database connectivity.\n",
      );
    process.exitCode = 1;
    await app?.close().catch((closeError: unknown) => {
      app?.log.error({ err: closeError }, "Server cleanup after startup failure failed");
    });
    await pool?.end().catch(() => {});
    return;
  }

  if (!app) return;
  const server = app;
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.log.info(`Received ${signal}; closing server`);
    void server.close().then(
      async () => {
        await pool?.end();
        server.log.info("Server shutdown complete");
      },
      (error: unknown) => {
        server.log.error({ err: error }, "Server shutdown failed");
        process.exitCode = 1;
      },
    );
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer();
