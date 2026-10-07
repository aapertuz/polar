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
  const hero = read("features/missions/components/MissionHero.tsx");
  const styles = read("pages/home/styles/home.css");
  assert.ok(hero.indexOf('className="deadline-display"') < hero.indexOf("mission.outcome"));
  assert.ok(hero.indexOf("mission.outcome") < hero.indexOf('className="mission-deadline"'));
  assert.match(styles, /\.mission-hero\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.mission-hero\s*\{[^}]*flex-direction:\s*column/s);
});

test("countdown separators align on center and the system island has square corners", () => {
  const styles = read("pages/home/styles/home.css");
  assert.match(styles, /\.countdown-digits\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.system-island\s*\{[^}]*border-radius:\s*16px/s);
  assert.equal(/\.system-island\s*\{[^}]*border-radius:\s*9999px/s.test(styles), false);
});

test("empty default keeps desktop composition and opens Quick AI", () => {
  const home = read("pages/home/HomeScreen.tsx");
  const model = read("pages/home/hooks/useHomeScreen.ts");
  for (const component of [
    "MissionSwitcher",
    "HomeMissionWindow",
    "HomeTimelineWindow",
    "QuickAiSurface",
  ]) {
    assert.match(home, new RegExp(`<${component}\\b`));
  }
  assert.match(home, /className="desktop-art"/);
  assert.match(model, /initialIntent: "new-mission"/);
  assert.doesNotMatch(model, /fixtures/);
  assert.match(home, /mission \? <HomeMissionWindow model=\{model\} \/> : <EmptyWorkspace \/>/);
});

test("island keeps the Polar mark and balances people left of the clock", () => {
  const island = read("components/desktop/components/SystemIsland.tsx");
  assert.match(island, /<PolarMark/);
  assert.ok(
    island.indexOf('aria-label="Mission people"') < island.indexOf('className="island-clock"'),
  );
  assert.ok(
    island.indexOf('className="island-clock"') <
      island.indexOf('className="island-button notification-button"'),
  );
  assert.match(read("features/quick-ai/components/QuickAiSurface.tsx"), /quick-ai\.css/);
});
