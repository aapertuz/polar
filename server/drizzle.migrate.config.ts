import { defineConfig } from "drizzle-kit";
import schemaConfig from "./drizzle.config.js";
import { getDatabaseConfig } from "./src/environment.js";

export default defineConfig({
  ...schemaConfig,
  dbCredentials: { url: getDatabaseConfig(process.env, true).databaseUrl },
});
