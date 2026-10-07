import test from "node:test";
import assert from "node:assert/strict";
import { quickAiExpansionMotion } from "../src/features/quick-ai/utils/quickAiMotion.ts";

test("Quick AI expands its actual height from a visible strip with delayed content", () => {
  const { surfaceMotion, contentMotion } = quickAiExpansionMotion(false, true);
  assert.equal(surfaceMotion.initial.height, 48);
  assert.equal(surfaceMotion.initial.opacity, 1);
  assert.equal(surfaceMotion.animate.height, "auto");
  assert.equal(surfaceMotion.transition.height.duration, 0.5);
  assert.ok(contentMotion.transition.delay > 0);
  const closing = quickAiExpansionMotion(false, false);
  assert.equal(closing.surfaceMotion.animate.height, 48);
  assert.ok(
    closing.surfaceMotion.transition.height.duration < surfaceMotion.transition.height.duration,
  );
});

test("Quick AI reduced motion uses opacity without height expansion or content delay", () => {
  for (const present of [true, false]) {
    const { surfaceMotion, contentMotion } = quickAiExpansionMotion(true, present);
    assert.equal(surfaceMotion.initial.height, "auto");
    assert.equal(surfaceMotion.animate.height, "auto");
    assert.equal(surfaceMotion.transition.height.duration, 0);
    assert.equal(contentMotion.transition.delay, 0);
  }
});
