import assert from "node:assert/strict";
import { test } from "node:test";
import { createDesktopReview } from "./desktop-review.mjs";

const status = {
  state: "ready",
  native: { managed: true, pid: 123 },
  automation: { appPath: "/checkout/.polar-dev/Polar Dev.app", appId: "polar.dev" },
};
const tree = "Window: polar\n7 standard window polar, Secondary Actions: Raise";
function fixture() {
  const calls = [];
  const fail = new Set();
  const app = {};
  for (const name of [
    "getAXState",
    "getAXStateAndScreenshot",
    "performSecondaryAction",
    "click",
    "setValue",
  ]) {
    app[name] = async (...args) => {
      calls.push([name, ...args]);
      if (fail.has(name)) throw new Error("SCStreamErrorDomain Code -3811");
      if (name === "getAXState") return tree;
      if (name === "getAXStateAndScreenshot") return { state: tree, screenshot: "image" };
    };
  }
  const cua = {
    async getApp(path) {
      calls.push(["bind", path]);
      if (fail.has("bind")) throw new Error("SCStreamErrorDomain Code -3811");
      return app;
    },
  };
  return { calls, cua, app, fail };
}

test("process readiness without managed identity cannot bind or launch an app", async () => {
  const { cua, calls } = fixture();
  for (const invalid of [
    null,
    { ...status, state: "starting" },
    { ...status, native: { pid: 123 } },
  ]) {
    await assert.rejects(createDesktopReview(cua, invalid), /fresh ready status/);
  }
  assert.deepEqual(calls, []);
});

test("an already-running target is bound once and raised before each single observation", async () => {
  const { cua, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  calls.length = 0;
  assert.equal(await review.capture(), "image");
  assert.equal(await review.app.getAXState({ emit: false }), tree);
  assert.equal(await review.app.getScreenshot({ emit: false }), "image");
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "performSecondaryAction",
      "getAXStateAndScreenshot",
      "performSecondaryAction",
      "getAXState",
      "performSecondaryAction",
      "getAXStateAndScreenshot",
    ],
  );
  for (const call of calls.filter(([name]) => name === "performSecondaryAction")) {
    assert.deepEqual(call, ["performSecondaryAction", 7, "Raise"]);
  }
});

test("initial capture failure or missing/ambiguous windows stops before actions", async () => {
  for (const state of [
    "noWindowsAvailable",
    "7 standard window polar",
    tree + "\n8 standard window other, Secondary Actions: Raise",
    null,
  ]) {
    const { cua, app, calls } = fixture();
    app.getAXState = async () => {
      if (state === null) throw new Error("SCStreamErrorDomain Code -3811");
      return state;
    };
    await assert.rejects(createDesktopReview(cua, status));
    assert.equal(calls.length, 1);
  }
});

test("AX-only failure uses the same budget and blocks every interaction until recovery", async () => {
  const { cua, calls, fail } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("getAXState");
  await assert.rejects(review.app.getAXState(), (error) => {
    assert.match(error.message, /recovery-required during getAXState/);
    assert.match(error.cause.message, /-3811/);
    return true;
  });
  const count = calls.length;
  for (const operation of [
    () => review.capture(),
    () => review.observe(),
    () => review.app.click(12),
  ]) {
    await assert.rejects(operation(), /recovery-required/);
  }
  assert.equal(calls.length, count);
  fail.clear();
  calls.length = 0;
  assert.equal(await review.recoverCapture(status), "image");
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "performSecondaryAction",
      "bind",
      "getAXState",
      "performSecondaryAction",
      "getAXStateAndScreenshot",
    ],
  );
  fail.add("getAXStateAndScreenshot");
  await assert.rejects(review.capture(), /blocked/);
  await assert.rejects(review.recoverCapture(status), /budget/);
});

test("action failure is recorded as uncertain and never automatically replayed", async () => {
  const { cua, calls, fail } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("click");
  await assert.rejects(review.app.click(15), /may already have applied/);
  assert.equal(review.evidence.failedOperation, "click");
  fail.clear();
  await review.recoverCapture(status);
  assert.equal(calls.filter(([name]) => name === "click").length, 1);
});

test("a second action requires fresh observations instead of reusing pre-edit Save indices", async () => {
  const { cua, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  await review.app.setValue(12, "test brief");
  await assert.rejects(review.app.click(15), /Observe after the previous action/);
  assert.equal(calls.filter(([name]) => name === "click").length, 0);
  await review.observe();
  await review.app.click(15);
  assert.equal(calls.filter(([name]) => name === "click").length, 1);
});

test("a raise failure blocks capture, consumes only one recovery, and never loops", async () => {
  const { cua, fail, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("performSecondaryAction");
  await assert.rejects(review.capture(), /recovery-required/);
  const count = calls.length;
  await assert.rejects(review.recoverCapture(status), /blocked/);
  assert.equal(calls.length, count + 1);
  await assert.rejects(review.app.getAXStateAndScreenshot(), /blocked/);
  await assert.rejects(review.recoverCapture(status), /budget/);
});

test("a new native PID never receives the old window's cached index", async () => {
  const { cua, calls, fail } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("getAXStateAndScreenshot");
  await assert.rejects(review.capture());
  fail.clear();
  calls.length = 0;
  await review.recoverCapture({ ...status, native: { ...status.native, pid: 456 } });
  assert.equal(calls[0][0], "bind");
  assert.equal(review.evidence.pid, 456);
});

test("unready status, wrong app, failed rebind or recovery capture exhausts the budget", async () => {
  for (const scenario of ["unready", "wrong-app", "bind", "capture"]) {
    const { cua, fail } = fixture();
    const review = await createDesktopReview(cua, status);
    fail.add("getAXStateAndScreenshot");
    await assert.rejects(review.capture());
    fail.clear();
    if (scenario === "bind") fail.add("bind");
    if (scenario === "capture") fail.add("getAXStateAndScreenshot");
    const next =
      scenario === "unready"
        ? { ...status, state: "stopped" }
        : scenario === "wrong-app"
          ? { ...status, automation: { ...status.automation, appId: "other" } }
          : status;
    await assert.rejects(review.recoverCapture(next));
    await assert.rejects(review.observe(), /blocked/);
    await assert.rejects(review.recoverCapture(status), /budget/);
  }
});

test("a combined observation with no screenshot cannot count as visual evidence", async () => {
  const { cua, app } = fixture();
  const review = await createDesktopReview(cua, status);
  app.getAXStateAndScreenshot = async () => ({ state: tree });
  await assert.rejects(review.capture(), (error) => {
    assert.equal(error.cause.message, "Screenshot unavailable.");
    return true;
  });
});

const inactive = () =>
  new Error(
    "Computer Use is not active for '/checkout/.polar-dev/Polar Dev.app'. You first must call `get_app_state` to get the latest state before doing other Computer Use actions.",
  );

test("a binding deactivated between turns refreshes once and discovers new indices without spending recovery", async () => {
  const { cua, app, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  const raise = app.performSecondaryAction;
  let stale = true;
  app.performSecondaryAction = async (...args) => {
    if (stale) {
      stale = false;
      calls.push(["inactive-raise", ...args]);
      throw inactive();
    }
    return raise(...args);
  };
  app.getAXState = async () => {
    calls.push(["getAXState"]);
    return tree.replace("7 standard", "21 standard");
  };
  calls.length = 0;
  await review.observe();
  assert.deepEqual(
    calls.map(([name]) => name),
    ["inactive-raise", "bind", "getAXState", "performSecondaryAction", "getAXState"],
  );
  assert.deepEqual(calls[3], ["performSecondaryAction", 21, "Raise"]);
  assert.equal(review.evidence.bindingRefreshes, 1);
  assert.equal(review.evidence.recoveryUsed, false);
  assert.equal(review.evidence.captureState, "available");
});

test("an inactive action requires observation and never replays the edit or Save", async () => {
  const { cua, app, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  app.click = async () => {
    calls.push(["rejected-click"]);
    throw inactive();
  };
  await assert.rejects(review.app.click(15), /binding is inactive/);
  assert.equal(review.evidence.captureState, "unverified");
  assert.equal(review.evidence.recoveryUsed, false);
  await assert.rejects(review.app.setValue(12, "replay"), /Observe after/);
  await review.observe();
  assert.equal(calls.filter(([name]) => name === "rejected-click").length, 1);
  assert.equal(review.evidence.needsObservation, false);
});

test("a genuine capture failure can use its one rebind even if the old binding is now inactive", async () => {
  const { cua, app, fail, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("getAXStateAndScreenshot");
  await assert.rejects(review.capture(), /recovery-required/);
  fail.clear();
  const raise = app.performSecondaryAction;
  let stale = true;
  app.performSecondaryAction = async (...args) => {
    if (stale) {
      stale = false;
      calls.push(["inactive-raise"]);
      throw inactive();
    }
    return raise(...args);
  };
  calls.length = 0;
  await review.recoverCapture(status);
  assert.equal(calls.filter(([name]) => name === "bind").length, 1);
  assert.equal(review.evidence.recoveryUsed, true);
  assert.equal(review.evidence.captureState, "available");
  fail.add("getAXStateAndScreenshot");
  await assert.rejects(review.capture(), /blocked/);
});

test("refreshing an inactive binding stops on a real capture failure instead of retrying it", async () => {
  const { cua, app, fail, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  app.performSecondaryAction = async () => {
    throw inactive();
  };
  fail.add("bind");
  await assert.rejects(review.observe(), /recovery-required/);
  assert.match(review.evidence.failedCause, /-3811/);
  const count = calls.length;
  await assert.rejects(review.observe(), /recovery-required/);
  assert.equal(calls.length, count);
  assert.equal(review.evidence.bindingRefreshes, 1);
});

test("persistent inactive rejection cannot create an activation loop", async () => {
  const { cua, app, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  app.performSecondaryAction = async () => {
    throw inactive();
  };
  calls.length = 0;
  await assert.rejects(review.observe(), /recovery-required/);
  assert.equal(calls.filter(([name]) => name === "bind").length, 1);
  await assert.rejects(review.observe(), /recovery-required/);
  assert.equal(calls.filter(([name]) => name === "bind").length, 1);
});

test("an explicit user retry works on the same PID after automatic recovery is exhausted", async () => {
  const { cua, fail, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("getAXStateAndScreenshot");
  await assert.rejects(review.capture());
  await assert.rejects(review.recoverCapture(status), /blocked/);
  fail.clear();
  assert.equal(await review.retryCapture(status, "user-message-15:19"), "image");
  assert.equal(review.evidence.pid, status.native.pid);
  assert.equal(review.evidence.recoveryUsed, true);
  assert.deepEqual(review.evidence.userRetryRequests, ["user-message-15:19"]);
  const count = calls.length;
  await assert.rejects(review.retryCapture(status, "user-message-15:19"), /already been attempted/);
  assert.equal(calls.length, count);
  fail.add("getAXStateAndScreenshot");
  await assert.rejects(review.capture(), /blocked/);
  await assert.rejects(review.recoverCapture(status), /budget/);
});

test("failed explicit retry stops without automatic recovery or mutation replay", async () => {
  const { cua, fail, calls } = fixture();
  const review = await createDesktopReview(cua, status);
  fail.add("click");
  await assert.rejects(review.app.click(15));
  fail.add("bind");
  await assert.rejects(review.retryCapture(status, "user-message-2"), /blocked/);
  const count = calls.length;
  await assert.rejects(review.retryCapture(status, "user-message-2"), /already been attempted/);
  await assert.rejects(review.app.click(15), /blocked/);
  await assert.rejects(review.recoverCapture(status), /budget/);
  assert.equal(calls.length, count);
  assert.equal(calls.filter(([name]) => name === "click").length, 1);
});

test("explicit retry requires a recorded request and fresh matching identity", async () => {
  for (const scenario of ["missing-request", "unready", "wrong-app"]) {
    const { cua, calls } = fixture();
    const review = await createDesktopReview(cua, status);
    const count = calls.length;
    const fresh =
      scenario === "unready"
        ? { ...status, state: "stopped" }
        : scenario === "wrong-app"
          ? { ...status, automation: { ...status.automation, appId: "other" } }
          : status;
    await assert.rejects(
      review.retryCapture(fresh, scenario === "missing-request" ? "" : scenario),
    );
    assert.equal(calls.length, count);
  }
});
