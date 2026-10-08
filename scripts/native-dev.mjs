import { desktopDevelopmentEnvironment } from "./environment.mjs";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const runtime = join(root, ".polar-dev");
const leasePath = join(runtime, "session.json");
const appPath = join(runtime, "Polar Dev.app");
const appBinary = join(appPath, "Contents/MacOS/polar");
const nativePath = join(runtime, "native.json");
const devBinary = join(root, "native/src-tauri/target/debug/polar");
const appId = "com.antoniopertuz.polar.dev";

function command(program, args) {
  const result = spawnSync(program, args, { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${program} inspection failed: ${result.error?.message || result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

export function acquireLease(path, owner, isAlive = processExists) {
  mkdirSync(dirname(path), { recursive: true });
  // Serialize stale-file recovery too: two starters must not unlink each other's lease.
  const gate = `${path}.guard`;
  try {
    mkdirSync(gate);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return false;
  }
  try {
    try {
      writeFileSync(path, JSON.stringify(owner), { flag: "wx" });
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const previous = readJson(path);
      if (!previous || !Number.isInteger(previous.pid) || isAlive(previous.pid)) return false;
      unlinkSync(path);
      writeFileSync(path, JSON.stringify(owner), { flag: "wx" });
      return true;
    }
  } finally {
    rmdirSync(gate);
  }
}

export function classify({ server, native, watcher, launcher, occupied }) {
  if (occupied && !server) return "port-conflict";
  if (server && native) return "ready";
  if (launcher || watcher) return "starting";
  if (native) return "native-only";
  if (server) return "vite-only";
  return "stopped";
}

function belongsToCheckout(entry) {
  const cwd = spawnSync("lsof", ["-a", "-p", String(entry.pid), "-d", "cwd", "-Fn"], {
    encoding: "utf8",
  });
  if (cwd.error || cwd.status !== 0)
    throw new Error(`Cannot establish process ${entry.pid}'s checkout.`);
  return cwd.stdout
    .split("\n")
    .some((line) =>
      [root, join(root, "native"), join(root, "native/src-tauri")].some(
        (path) => line === `n${path}`,
      ),
    );
}

export async function inspect() {
  if (!["darwin", "linux"].includes(process.platform)) {
    throw new Error("Native instance inspection currently supports macOS and Linux only.");
  }
  const processes = command("ps", ["-axo", "pid=,ppid=,command="])
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
      return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] }] : [];
    });
  const listeners = spawnSync("lsof", ["-nP", "-iTCP:1420", "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  });
  if (listeners.error || (listeners.status !== 0 && listeners.status !== 1)) {
    throw new Error(
      `Port inspection failed: ${listeners.error?.message || listeners.stderr.trim()}`,
    );
  }
  const occupied = listeners.stdout.trim().length > 0;
  let server = null;
  if (occupied) {
    try {
      const response = await fetch("http://localhost:1420/__polar_dev", {
        signal: AbortSignal.timeout(1500),
      });
      const identity = await response.json();
      if (response.ok && identity.root === root && identity.kind === "polar-vite")
        server = identity;
    } catch {
      // Unidentified listeners are conflicts, never assumed to be this checkout.
    }
  }
  const record = readJson(nativePath);
  const native =
    processes.find(
      (entry) => entry.command === appBinary || entry.command.startsWith(`${appBinary} `),
    ) ||
    processes.find(
      (entry) => entry.command === devBinary || entry.command.startsWith(`${devBinary} `),
    ) ||
    processes.find(
      (entry) =>
        /^(?:\.\/)?target\/debug\/polar(?:\s|$)/.test(entry.command) && belongsToCheckout(entry),
    );
  const managed = Boolean(
    native &&
    native.command.startsWith(appBinary) &&
    record?.root === root &&
    record?.pid === native.pid &&
    server &&
    (!server.session || record?.session === server.session),
  );
  const lease = readJson(leasePath);
  const launcher = processes.find(
    (entry) =>
      entry.pid === lease?.pid &&
      lease?.root === root &&
      entry.command.includes("scripts/native-dev.mjs") &&
      entry.command.endsWith(" dev"),
  );
  const watcher = processes.find((entry) => {
    if (!/\btauri(?:-cli)?(?:\.js)?\s+dev\b/.test(entry.command)) return false;
    return belongsToCheckout(entry);
  });
  const packaged = processes.filter((entry) =>
    /\/polar\.app\/Contents\/MacOS\/polar(?:\s|$)/.test(entry.command),
  );
  return {
    state: classify({ server, native, watcher, launcher, occupied }),
    root,
    server: server
      ? { url: "http://localhost:1420", pid: server.pid, session: server.session }
      : null,
    native: native
      ? {
          pid: native.pid,
          path: native.command.startsWith(appBinary) ? appBinary : devBinary,
          managed,
        }
      : null,
    launcher: launcher?.pid || null,
    watcher: watcher?.pid || null,
    packaged: packaged.map((entry) => ({
      pid: entry.pid,
      path: entry.command.split("/Contents/MacOS/polar")[0] + "/Contents/MacOS/polar",
    })),
    automation: managed ? { appPath, appId } : null,
  };
}

function report(status) {
  console.log(JSON.stringify(status, null, 2));
  if (status.state === "ready" && !status.automation)
    console.log(
      "Existing development app has no verified automation identity. Reuse it for manual review; stop it yourself before switching to the guarded launcher.",
    );
  if (status.state === "port-conflict")
    console.log(
      "Port 1420 is occupied by an unidentified server. Resolve the conflict before starting Polar.",
    );
  if (status.state === "native-only")
    console.log(
      "A native process exists without this checkout's Vite server. Resolve that session before starting another.",
    );
}

function runChild(program, args, options = {}) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(program, args, { stdio: "inherit", ...options });
    const forward = (signal) => {
      if (options.detached) {
        try {
          process.kill(-child.pid, signal);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      } else child.kill(signal);
    };
    const interrupt = () => forward("SIGINT");
    const terminate = () => forward("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    const cleanup = () => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    };
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolveExit(code ?? (signal === "SIGINT" ? 130 : 143));
    });
  });
}

export function prepareApp(binary, pid) {
  if (!process.env.POLAR_DEV_SESSION)
    throw new Error("Development runner requires an owned session.");
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("Invalid native runner PID.");
  mkdirSync(dirname(appBinary), { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Polar Dev</string>
<key>CFBundleDisplayName</key><string>Polar Dev</string>
<key>CFBundleIdentifier</key><string>${appId}</string>
<key>CFBundleExecutable</key><string>polar</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>0.1.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>\n`;
  writeFileSync(join(appPath, "Contents/Info.plist"), plist);
  copyFileSync(binary, appBinary);
  writeFileSync(
    nativePath,
    JSON.stringify({
      pid,
      root,
      session: process.env.POLAR_DEV_SESSION,
      source: binary,
      builtAt: statSync(binary).mtimeMs,
    }),
  );
  return appBinary;
}

async function develop() {
  let status = await inspect();
  report(status);
  if (["ready", "starting"].includes(status.state)) {
    console.log("Reusing the existing development session; no processes launched.");
    return 0;
  }
  if (["port-conflict", "native-only"].includes(status.state)) return 1;
  if (!acquireLease(leasePath, { pid: process.pid, root })) {
    console.log(
      `Development launch ownership is held or unreadable at ${leasePath}; no processes launched. Inspect the owner before removing stale files.`,
    );
    return 0;
  }
  try {
    // Recheck after exclusive acquisition to cover concurrent starts.
    status = await inspect();
    if (status.native || status.watcher || status.state === "port-conflict") {
      report(status);
      return status.state === "port-conflict" ? 1 : 0;
    }
    const session = `${process.pid}-${Date.now()}`;
    const config = { build: { beforeDevCommand: status.server ? "" : "pnpm dev" } };
    const args = [
      "--filter",
      "@polar/native",
      "exec",
      "tauri",
      "dev",
      "--config",
      JSON.stringify(config),
    ];
    if (process.platform === "darwin") {
      const triple = command("rustc", ["-vV"]).match(/^host: (.+)$/m)?.[1];
      if (!triple) throw new Error("Cannot determine Rust host target.");
      const runner = ["/bin/sh", join(root, "scripts/native-dev-runner.sh")];
      args.push("--", "--config", `target.${triple}.runner=${JSON.stringify(runner)}`);
      console.log(`Development automation target: ${appPath} (${appId})`);
    }
    return await runChild("pnpm", args, {
      cwd: root,
      detached: true,
      env: {
        ...desktopDevelopmentEnvironment(),
        POLAR_DEV_NODE: process.execPath,
        POLAR_DEV_SESSION: status.server?.session || session,
      },
    });
  } finally {
    if (readJson(leasePath)?.pid === process.pid) unlinkSync(leasePath);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2];
    if (mode === "status") report(await inspect());
    else if (mode === "dev") process.exitCode = await develop();
    else if (mode === "prepare-app" && process.argv[3])
      console.log(prepareApp(process.argv[3], Number(process.argv[4])));
    else throw new Error("Usage: native-dev.mjs status|dev|prepare-app <binary> <pid>");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
