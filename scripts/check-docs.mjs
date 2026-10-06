import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const required = [
  "AGENTS.md", "docs/README.md", "docs/PLANS.md", "docs/VERIFICATION.md",
  "docs/exec-plans/active", "docs/exec-plans/completed",
  "docs/exec-plans/tech-debt-tracker.md", "docs/changes/README.md",
  ".agents/skills/README.md",
];
for (const path of required) {
  if (!existsSync(resolve(root, path))) errors.push(`Missing harness path: ${path}`);
}
const agents = resolve(root, "AGENTS.md");
if (existsSync(agents) && readFileSync(agents, "utf8").trimEnd().split("\n").length > 100) {
  errors.push("AGENTS.md exceeds 100 lines; move details into linked docs.");
}
function markdownFiles(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return path.endsWith(".md") ? [path] : [];
  return readdirSync(path, { withFileTypes: true }).flatMap(entry =>
    entry.isSymbolicLink() ? [] : markdownFiles(resolve(path, entry.name)));
}
for (const file of [agents, ...markdownFiles(resolve(root, "docs")),
  ...markdownFiles(resolve(root, ".agents/skills"))]) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    const path = target.split(/[?#]/)[0];
    try {
      if (path && !existsSync(resolve(dirname(file), decodeURIComponent(path)))) {
        errors.push(`${file}: broken local link ${target}`);
      }
    } catch {
      errors.push(`${file}: invalid link encoding ${target}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Harness documentation checks passed.");
}
