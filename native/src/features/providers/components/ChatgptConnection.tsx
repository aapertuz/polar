import { useChatgptConnection } from "@/features/providers/hooks/useChatgptConnection";
import { Dialog } from "@/components/ui/Dialog";
import "@/features/providers/styles/providers.css";

export function ChatgptConnection() {
  const model = useChatgptConnection();
  return (
    <section className="provider-connection" aria-labelledby="chatgpt-heading">
      {model.showPlanNotice && (
        <Dialog
          title="You’re using your ChatGPT plan"
          onClose={model.acknowledgePlan}
          eyebrow="POLAR / CHATGPT"
        >
          <p className="overlay-muted">
            Eligible AI requests in Polar use your ChatGPT plan or credits. You can manage usage and
            app limits in ChatGPT settings.
          </p>
          <div className="provider-actions">
            <button className="dark-button" onClick={model.acknowledgePlan}>
              Got it
            </button>
            <button className="provider-button" onClick={model.openUsage}>
              Manage usage ↗
            </button>
          </div>
        </Dialog>
      )}
      <div className="provider-heading">
        <h3 id="chatgpt-heading">ChatGPT</h3>
        <span className="provider-status">
          {model.active?.connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <p className="overlay-muted">
        Use your ChatGPT plan on this device. Your credentials stay in secure system storage.
      </p>
      {!model.desktop ? (
        <p className="provider-notice">Open the Polar desktop app to connect your account.</p>
      ) : (
        <>
          {model.accountOptions.length > 0 && (
            <label className="provider-field">
              Account registration
              <select
                value={model.active?.id ?? ""}
                onChange={model.selectAccount}
                disabled={model.busy}
              >
                {model.accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="provider-actions">
            <button className="chatgpt-signin" onClick={model.addAccount} disabled={model.busy}>
              Continue with ChatGPT
            </button>
            {model.active && (
              <button className="provider-button" onClick={model.reconnect} disabled={model.busy}>
                Reconnect
              </button>
            )}
          </div>
          {model.active?.connected && (
            <>
              <label className="provider-field">
                Model · Using ChatGPT plan
                <select
                  value={model.selectedModel}
                  onChange={model.selectModel}
                  disabled={model.busy || model.models.length === 0}
                >
                  <option value="" disabled>
                    Choose a model
                  </option>
                  {model.models.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.display_name}
                    </option>
                  ))}
                </select>
              </label>
              {model.models.length === 0 && !model.busy && (
                <p className="overlay-muted">
                  No available models were loaded. Try reloading or reconnecting.
                </p>
              )}
              <p className="provider-detail">
                Testing sends a short confirmation prompt and uses your ChatGPT allowance. Mission
                context is not sent.
              </p>
              <div className="provider-actions">
                <button
                  className="dark-button"
                  onClick={model.testConnection}
                  disabled={model.busy || !model.selectedModel}
                >
                  Test connection
                </button>
                <button
                  className="provider-button"
                  onClick={model.disconnect}
                  disabled={model.busy}
                >
                  Disconnect
                </button>
              </div>
            </>
          )}
          <div className="provider-feedback" aria-live="polite" aria-atomic="true">
            {model.operation === "connecting" && (
              <p>
                Finish signing in through your browser. Keep Polar and Settings open; sign-in
                expires after 30 minutes.
              </p>
            )}
            {model.operation === "testing" && <p>Waiting for the model to complete the test…</p>}
            {model.operation === "disconnecting" && <p>Disconnecting and ending remote access…</p>}
            {model.busy &&
              model.operation !== "connecting" &&
              model.operation !== "testing" &&
              model.operation !== "disconnecting" && <p>Loading connection settings…</p>}
            {model.message && <p>{model.message}</p>}
          </div>
          {model.error && (
            <p className="provider-error" role="alert">
              {model.error}
            </p>
          )}
          {model.busy && model.operation !== "disconnecting" && (
            <button className="provider-button" onClick={model.cancel}>
              Cancel
            </button>
          )}
          <div className="provider-links">
            <button className="text-button" onClick={model.refresh} disabled={model.busy}>
              Reload
            </button>
            <button className="text-button" onClick={model.openUsage}>
              ChatGPT usage &amp; access ↗
            </button>
          </div>
        </>
      )}
      <p className="provider-detail">
        This connection enables provider access. Quick AI still uses the sample preview.
      </p>
    </section>
  );
}
