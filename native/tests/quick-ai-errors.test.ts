import assert from "node:assert/strict";
import test from "node:test";
import { errorMessage } from "../src/features/quick-ai/utils/errorMessage.ts";

test("native worker string rejections retain actionable messages", () => {
  const message = "Your ChatGPT session is no longer valid. Reconnect this account.";
  assert.equal(errorMessage(message, "Worker unavailable"), message);
  assert.equal(errorMessage(new Error(message), "Worker unavailable"), message);
});
test("unknown and empty worker errors retain a useful fallback", () => {
  for (const error of [null, undefined, {}, "", "  ", new Error("")])
    assert.equal(errorMessage(error, "Worker unavailable"), "Worker unavailable");
});
