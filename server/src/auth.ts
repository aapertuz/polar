import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import type { ServerConfig } from "./config.js";
import type { PolarDatabase } from "./db/client.js";
import * as schema from "./db/schema.js";

export function createAuth(db: PolarDatabase, config: ServerConfig) {
  return betterAuth({
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    advanced: {
      cookiePrefix: `polar-${config.environment}`,
      useSecureCookies: config.betterAuthUrl.startsWith("https://"),
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.authUser,
        session: schema.authSession,
        account: schema.authAccount,
        verification: schema.authVerification,
        deviceCode: schema.authDeviceCode,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    trustedOrigins: [config.betterAuthUrl],
    plugins: [
      bearer(),
      deviceAuthorization({
        verificationUri: `${config.betterAuthUrl}/device`,
        expiresIn: "30m",
        interval: "5s",
        validateClient: (clientId) => clientId === config.desktopClientId,
      }),
    ],
  });
}

export type PolarAuth = ReturnType<typeof createAuth>;
