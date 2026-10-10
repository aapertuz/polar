import test from "node:test";
import assert from "node:assert/strict";
import {
  RESIZE_EDGES,
  resizeWindow,
  windowResizeLimits,
} from "../src/components/desktop/utils/windowResize.ts";

const frame = { left: 100, top: 80, width: 624, height: 520 };
const limits = windowResizeLimits({ width: 1200, height: 900 });

test("every resize edge keeps its opposite edge anchored", () => {
  for (const edge of RESIZE_EDGES) {
    const next = resizeWindow(frame, edge, { x: 64, y: 32 }, limits);
    if (edge.includes("w")) assert.equal(next.left + next.width, frame.left + frame.width);
    else assert.equal(next.left, frame.left);
    if (edge.includes("n")) assert.equal(next.top + next.height, frame.top + frame.height);
    else assert.equal(next.top, frame.top);
    if (!edge.includes("e") && !edge.includes("w")) assert.equal(next.width, frame.width);
    if (!edge.includes("n") && !edge.includes("s")) assert.equal(next.height, frame.height);
  }
  assert.deepEqual(resizeWindow(frame, "nw", { x: 64, y: 32 }, limits), {
    left: 164,
    top: 112,
    width: 560,
    height: 488,
  });
});

test("northwest resizing respects readable minimums without moving the far edges", () => {
  const next = resizeWindow(frame, "nw", { x: 2000, y: 2000 }, limits);
  assert.deepEqual(next, { left: 364, top: 320, width: 360, height: 280 });
});

test("expansion stops at the viewport limit and works in both directions", () => {
  assert.deepEqual(resizeWindow(frame, "se", { x: 2000, y: 2000 }, limits), {
    left: 100,
    top: 80,
    width: 1176,
    height: 876,
  });
  assert.deepEqual(resizeWindow(frame, "nw", { x: -2000, y: -2000 }, limits), {
    left: -452,
    top: -276,
    width: 1176,
    height: 876,
  });
});

test("narrow and tiny workspaces never have a minimum larger than their maximum", () => {
  assert.deepEqual(windowResizeLimits({ width: 320, height: 240 }), {
    minWidth: 296,
    maxWidth: 296,
    minHeight: 216,
    maxHeight: 216,
  });
  const tiny = windowResizeLimits({ width: 12, height: 12 });
  assert.deepEqual(resizeWindow(frame, "se", { x: 0, y: 0 }, tiny), {
    left: 100,
    top: 80,
    width: 1,
    height: 1,
  });
});
