import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const read = (path: string) => readFileSync(new URL(path, `file://${root}`), "utf8");

test("homescreen omits the left system rail", () => {
  const home = read("pages/home/HomeScreen.tsx");
  assert.doesNotMatch(home, /SystemRail/);
});

test("mission overview leads with the recommendation and omits header facts and title", () => {
  const window = read("features/missions/components/MissionWindow.tsx");
  const overview = read("features/missions/components/MissionOverview.tsx");
  const styles = read("pages/home/styles/home.css");
  assert.equal(/<h1>/.test(window), false);
  assert.equal(/mission-facts/.test(window), false);
  assert.ok(overview.indexOf("mission.recommendation") < overview.indexOf("mission.assessment"));
  assert.match(styles, /\.contextual-insight\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.insight-copy strong\s*\{[^}]*font-size:\s*18px/s);
});

test("mission header centers the countdown above the outcome and deadline date", () => {
  const window = read("features/missions/components/MissionWindow.tsx");
  const styles = read("pages/home/styles/home.css");
  assert.ok(window.indexOf('className="deadline-display"') < window.indexOf("mission.outcome"));
  assert.ok(window.indexOf("mission.outcome") < window.indexOf('className="mission-deadline"'));
  assert.match(styles, /\.mission-hero\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.mission-hero\s*\{[^}]*flex-direction:\s*column/s);
});

test("countdown separators align on center and the system island has square corners", () => {
  const styles = read("pages/home/styles/home.css");
  assert.match(styles, /\.countdown-digits\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.system-island\s*\{[^}]*border-radius:\s*16px/s);
  assert.equal(/\.system-island\s*\{[^}]*border-radius:\s*9999px/s.test(styles), false);
});
