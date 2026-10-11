import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { desktopProductionEnvironment } from "./environment.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function run(args, env = process.env) {
  const child = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    return await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => done(code ?? (signal === "SIGINT" ? 130 : 143)));
    });
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
  }
}

async function build() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const nativeExit = await run(["--filter", "@polar/native", "build"]);
    return nativeExit === 0 ? run(["--filter", "@polar/server", "build"]) : nativeExit;
  }
  if (args.length !== 1 || args[0] !== "bundle") {
    throw new Error("Usage: pnpm build [bundle]");
  }
  if (process.platform !== "darwin") {
    throw new Error("pnpm build bundle currently creates a macOS DMG and must run on a Mac.");
  }
  const env = desktopProductionEnvironment();
  console.log(`Building production installer for ${env.POLAR_API_BASE_URL}`);
  const code = await run(["tauri", "build", "--bundles", "dmg", "--ci"], env);
  if (code === 0) console.log("Installer output: native/src-tauri/target/release/bundle/dmg/");
  return code;
}

try {
  process.exitCode = await build();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
