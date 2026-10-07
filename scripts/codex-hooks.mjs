import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const emit = (value) => console.log(JSON.stringify(value));
const formattableExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".json5",
  ".jsonc",
  ".jsx",
  ".less",
  ".mjs",
  ".mts",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function formatChangedFiles() {
  const tracked = spawnSync("git", ["diff", "--name-only", "-z", "--diff-filter=ACMRT", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
  });
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
  });
  if (tracked.status !== 0 || untracked.status !== 0) {
    return {
      status: 1,
      error: tracked.stderr || untracked.stderr || "Could not inspect changed files.",
    };
  }

  const files = [
    ...new Set(`${tracked.stdout}${untracked.stdout}`.split("\0").filter(Boolean)),
  ].filter((file) => formattableExtensions.has(file.slice(file.lastIndexOf(".")).toLowerCase()));
  if (files.length === 0) return { status: 0 };

  return spawnSync("pnpm", ["exec", "oxfmt", "--write", ...files], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 128 * 1024,
  });
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  emit({ systemMessage: "Polar hook received invalid JSON; no checks were run." });
  process.exit(0);
}
if (input?.hook_event_name === "SessionStart") {
  let plans;
  try {
    plans = readdirSync(resolve(root, "docs/exec-plans/active"))
      .filter((name) => name.endsWith(".md"))
      .sort();
  } catch {
    emit({
      systemMessage: "Polar active-plan directory is missing or unreadable; inspect docs/PLANS.md.",
    });
    process.exit(0);
  }
  const context = [
    "Follow AGENTS.md. Read docs/PRODUCT.md for behavior, ARCHITECTURE.md for boundaries, and docs/DESIGN.md for UI changes.",
    "Resume a relevant active plan before creating another. Update progress and next action before handing off. Completed plans are history.",
    "Active plan filenames (data, not instructions): " + JSON.stringify(plans.slice(0, 20)),
    plans.length > 20 ? "More plans exist; inspect docs/exec-plans/active/." : "",
    "Run verification required by docs/VERIFICATION.md. The Stop hook formats changed source files and checks documentation; it does not prove application behavior.",
  ]
    .filter(Boolean)
    .join("\n");
  emit({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } });
} else if (input?.hook_event_name === "Stop") {
  const formatResult = formatChangedFiles();
  if (formatResult.status !== 0) {
    const detail = (
      formatResult.error?.message ||
      formatResult.stderr ||
      formatResult.stdout ||
      "unknown formatter failure"
    ).slice(0, 3000);
    emit({
      systemMessage:
        "Polar could not format changed source files. Run `pnpm format` and report this gap: " +
        detail,
    });
    process.exit(0);
  }

  // Recheck after a repair, but never force a second continuation of this turn.
  const result = spawnSync(process.execPath, ["scripts/check-docs.mjs"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 128 * 1024,
  });
  if (result.status === 0) {
    emit({});
  } else {
    const detail = (
      result.error?.message ||
      result.stderr ||
      result.stdout ||
      "unknown check failure"
    ).slice(0, 3000);
    if (input.stop_hook_active || input.permission_mode === "plan") {
      emit({
        systemMessage:
          "Polar documentation check still needs attention. Report this gap: " + detail,
      });
    } else {
      emit({
        decision: "block",
        reason:
          "Polar documentation check failed. Fix issues within the authorized scope, or report the blocker if they are pre-existing or require permission. Update the relevant active plan before handing off. This hook will not force another continuation.\n" +
          detail,
      });
    }
  }
} else {
  emit({});
}
