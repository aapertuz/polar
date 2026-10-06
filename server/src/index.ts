import { createApp } from "./app.js";
import { getServerConfig } from "./config.js";

const app = createApp();

async function startServer(): Promise<void> {
  try {
    const config = getServerConfig();
    await app.listen(config);
    app.log.info(`Server listening at http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error({ err: error }, "Server startup failed");
    process.exitCode = 1;
    await app.close().catch((closeError: unknown) => {
      app.log.error({ err: closeError }, "Server cleanup after startup failure failed");
    });
    return;
  }

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Received ${signal}; closing server`);
    void app.close().then(
      () => app.log.info("Server shutdown complete"),
      (error: unknown) => {
        app.log.error({ err: error }, "Server shutdown failed");
        process.exitCode = 1;
      },
    );
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer();
