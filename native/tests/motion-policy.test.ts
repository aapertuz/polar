import test from "node:test";
import assert from "node:assert/strict";
import { contentMotion, popoverMotion } from "../src/components/ui/motionPolicy.ts";

test("reduced motion keeps feedback without moving or scaling content", () => {
  const content = contentMotion(true, false, true);
  assert.notEqual(content.initial, false);
  if (content.initial === false) throw new Error("Expected opacity feedback");
  assert.equal(content.initial.y, 0);
  assert.equal(content.animate.y, 0);
  assert.equal(content.exit.y, 0);
  assert.equal(content.initial.opacity, 0);
  assert.equal(content.animate.opacity, 1);
  const popover = popoverMotion(true, false);
  if (popover.initial === false) throw new Error("Expected opacity feedback");
  assert.equal(popover.initial.scale, 1);
  assert.equal(popover.animate.scale, 1);
});

test("keyboard-driven changes bypass entry motion and transition delays", () => {
  for (const reduced of [false, true]) {
    assert.equal(contentMotion(reduced, true, true).initial, false);
    assert.equal(contentMotion(reduced, true, true).transition.duration, 0);
    assert.equal(contentMotion(reduced, true, false).transition.duration, 0);
    assert.equal(popoverMotion(reduced, true).initial, false);
    assert.equal(popoverMotion(reduced, true).transition.duration, 0);
  }
});

test("normal content transitions remain restrained and exits are faster", () => {
  const content = contentMotion(false, false, true);
  if (content.initial === false) throw new Error("Expected content reveal");
  assert.ok(content.initial.y <= 4);
  assert.ok(content.transition.duration <= 0.3);
  assert.ok(contentMotion(false, false, false).transition.duration < content.transition.duration);
});
