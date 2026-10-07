import test from "node:test";
import assert from "node:assert/strict";
import { clampPosition, getWindowBounds } from "../src/components/desktop/utils/windowGeometry.ts";

const workspace = { left: 100, top: 80, width: 1000, height: 700 };

test("windows can move across the canvas and partly offscreen with a recoverable header", () => {
  const bounds = getWindowBounds(workspace, { left: 800, top: 100, width: 300, height: 600 });
  assert.deepEqual(clampPosition({ x: -900, y: -100 }, bounds), { x: -840, y: -50 });
  assert.deepEqual(clampPosition({ x: 900, y: 900 }, bounds), { x: 140, y: 632 });
});

test("ordinary positions are retained inside the workspace", () => {
  const bounds = getWindowBounds(workspace, { left: 100, top: 94, width: 600, height: 620 });
  assert.deepEqual(clampPosition({ x: 180, y: 25 }, bounds), { x: 180, y: 25 });
});

test("resizing to a smaller workspace recovers an offscreen window", () => {
  const window = { left: 100, top: 94, width: 600, height: 620 };
  const smaller = { ...workspace, width: 650, height: 640 };
  assert.deepEqual(clampPosition({ x: 900, y: 900 }, getWindowBounds(smaller, window)), {
    x: 490,
    y: 578,
  });
});

test("oversized windows still have room to move in both directions", () => {
  const bounds = getWindowBounds(workspace, { left: 400, top: 130, width: 1200, height: 900 });
  assert.deepEqual(clampPosition({ x: 500, y: 300 }, bounds), { x: 500, y: 300 });
  assert.deepEqual(clampPosition({ x: -2000, y: -500 }, bounds), { x: -1340, y: -80 });
});

test("zero available movement never yields an inverted range", () => {
  const tinyCanvas = { left: 0, top: 0, width: 100, height: 48 };
  const bounds = getWindowBounds(tinyCanvas, { ...tinyCanvas, height: 200 }, 48);
  assert.deepEqual(bounds, { left: 0, right: 0, top: 0, bottom: 0 });
  assert.deepEqual(clampPosition({ x: 20, y: -20 }, bounds), { x: 0, y: 0 });
});
