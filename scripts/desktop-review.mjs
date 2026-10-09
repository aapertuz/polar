// Run from cua_repl using only its documented native-app API.
// On macOS, AX observations also capture internally; they can fail with -3811.
function targetFromStatus(status) {
  if (
    status?.state !== "ready" ||
    !status.native?.managed ||
    !Number.isInteger(status.native.pid) ||
    status.native.pid <= 0 ||
    !status.automation?.appPath ||
    !status.automation?.appId
  ) {
    throw new Error("Desktop review requires fresh ready status with a managed automation target.");
  }
  return { ...status.automation, pid: status.native.pid };
}

function windowFromState(state) {
  const windows = state.split("\n").filter((line) => /^\d+ standard window\b/.test(line));
  if (windows.length !== 1 || !windows[0].includes("Secondary Actions: Raise")) {
    throw new Error("Expected one discoverable standard window with the documented Raise action.");
  }
  return Number(windows[0].match(/^\d+/)[0]);
}

function isInactiveBinding(cause) {
  // This explicit pre-action rejection requests observation; it is not -3811.
  return (
    typeof cause?.message === "string" &&
    cause.message.startsWith("Computer Use is not active for '") &&
    cause.message.includes("get_app_state")
  );
}

const actions = new Set([
  "paste",
  "click",
  "drag",
  "pressKey",
  "scroll",
  "selectText",
  "setValue",
  "typeText",
  "performSecondaryAction",
]);

export async function createDesktopReview(cua, status) {
  let target = targetFromStatus(status);
  // Initial binding itself captures. If it fails there is no safe cached window to raise.
  let app = await cua.getApp(target.appPath);
  let windowIndex = windowFromState(await app.getAXState({ emit: false, disableDiffing: true }));
  let captureState = "unverified";
  let recoveryUsed = false;
  let needsObservation = false;
  let failedOperation;
  let failedCause;
  let bindingRefreshes = 0;
  const userRetryRequests = new Set();

  function assertAvailable() {
    if (["recovery-required", "blocked"].includes(captureState)) {
      throw new Error(`Native review ${captureState}; stop actions and observations.`);
    }
  }

  function failed(operation, cause) {
    captureState = recoveryUsed ? "blocked" : "recovery-required";
    failedOperation = operation;
    failedCause = cause?.message ?? String(cause);
    return new Error(
      `Native review ${captureState} during ${operation} for ${target.appPath} ` +
        `(PID ${target.pid}). Obtain fresh native:status before the single recovery; ` +
        "a failed action may already have applied and must not be replayed automatically.",
      { cause },
    );
  }

  async function raiseForObservation() {
    try {
      await app.performSecondaryAction(windowIndex, "Raise");
    } catch (cause) {
      if (!isInactiveBinding(cause)) throw cause;
      // Across turns the tool may deactivate its binding. Its protocol requires
      // a new observation before any action; never loop or replay a mutation.
      bindingRefreshes++;
      app = await cua.getApp(target.appPath);
      windowIndex = windowFromState(await app.getAXState({ emit: false, disableDiffing: true }));
      await app.performSecondaryAction(windowIndex, "Raise");
    }
  }

  async function observe(options = {}, withScreenshot = false) {
    assertAvailable();
    const operation = withScreenshot ? "getAXStateAndScreenshot" : "getAXState";
    try {
      // Use the last observed window: never request another capture just to find Raise.
      await raiseForObservation();
      const result = await app[operation]({ ...options, disableDiffing: true });
      const state = withScreenshot ? result.state : result;
      windowIndex = windowFromState(state);
      if (withScreenshot && !result.screenshot) throw new Error("Screenshot unavailable.");
      needsObservation = false;
      captureState = "available";
      return result;
    } catch (cause) {
      throw failed(operation, cause);
    }
  }

  async function capture(options) {
    return (await observe(options, true)).screenshot;
  }

  // Keep every documented interaction under the same budget; don't expose the raw app.
  const guardedApp = new Proxy(
    {},
    {
      get(_object, name) {
        if (name === "getAXState") return (options) => observe(options);
        if (name === "getScreenshot") return capture;
        if (name === "getAXStateAndScreenshot") return (options) => observe(options, true);
        if (!actions.has(name)) return undefined;
        return async (...args) => {
          assertAvailable();
          if (needsObservation) {
            throw new Error(
              "Observe after the previous action before using another element or action.",
            );
          }
          try {
            const result = await app[name](...args);
            needsObservation = true;
            return result;
          } catch (cause) {
            if (isInactiveBinding(cause)) {
              needsObservation = true;
              failedOperation = name;
              failedCause = cause.message;
              throw new Error(
                "App binding is inactive; observe fresh state and re-derive indices before deciding the next action.",
                { cause },
              );
            }
            throw failed(name, cause);
          }
        };
      },
    },
  );

  async function rebindAndCapture(freshStatus, operation) {
    captureState = "blocked";
    const freshTarget = targetFromStatus(freshStatus);
    if (freshTarget.appPath !== target.appPath || freshTarget.appId !== target.appId) {
      throw new Error("Recovery must target the same development app, using fresh status.");
    }
    try {
      if (freshTarget.pid === target.pid) {
        // Raise before getApp's implicit capture, using this binding's observed index.
        try {
          await app.performSecondaryAction(windowIndex, "Raise");
        } catch (cause) {
          // The one recovery has not rebound yet. An inactive tool session
          // requires that rebind first; other Raise errors still stop it.
          if (!isInactiveBinding(cause)) throw cause;
        }
      }
      target = freshTarget;
      app = await cua.getApp(target.appPath);
      // A restarted app has different AX indices; never carry indices across PIDs.
      windowIndex = windowFromState(await app.getAXState({ emit: false, disableDiffing: true }));
      captureState = "unverified";
      return await capture();
    } catch (cause) {
      if (captureState === "blocked") throw failed(operation, cause);
      captureState = "blocked";
      throw cause;
    }
  }

  return {
    app: guardedApp,
    get evidence() {
      return {
        ...target,
        captureState,
        recoveryUsed,
        needsObservation,
        failedOperation,
        failedCause,
        bindingRefreshes,
        userRetryRequests: [...userRetryRequests],
      };
    },
    observe,
    capture,
    async recoverCapture(freshStatus) {
      if (captureState !== "recovery-required" || recoveryUsed) {
        throw new Error(
          "Capture recovery is unavailable; the automatic budget does not reset after success.",
        );
      }
      recoveryUsed = true;
      return rebindAndCapture(freshStatus, "recoverCapture");
    },
    async retryCapture(freshStatus, userRequestId) {
      // Call only for an explicit user retry instruction. Record one stable ID
      // for that user message; the agent must not invent requests or IDs in a loop.
      if (typeof userRequestId !== "string" || !userRequestId.trim()) {
        throw new Error("Explicit retry requires a recorded user request ID.");
      }
      if (userRetryRequests.has(userRequestId)) {
        throw new Error("This user retry request has already been attempted.");
      }
      userRetryRequests.add(userRequestId);
      // A user request permits one attempt; it doesn't grant a new automatic budget.
      recoveryUsed = true;
      return rebindAndCapture(freshStatus, "retryCapture");
    },
  };
}
