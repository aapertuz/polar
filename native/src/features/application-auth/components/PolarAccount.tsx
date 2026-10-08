import { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import "@/features/application-auth/styles/application-auth.css";

export function PolarAccount() {
  const model = usePolarAccount();
  return (
    <section className="polar-account" aria-labelledby="polar-account-heading">
      <div className="provider-heading">
        <h3 id="polar-account-heading">Polar account</h3>
        <span className="provider-status">
          {model.status.authenticated
            ? "Connected"
            : model.operation === "connecting"
              ? "Signing in"
              : "Not connected"}
        </span>
      </div>
      <p className="overlay-muted">
        Sign in to sync your Polar workspace. This account is separate from your ChatGPT connection.
      </p>
      {!model.desktop ? (
        <p className="provider-notice">Open the Polar desktop app to connect a Polar account.</p>
      ) : (
        <>
          {model.status.authenticated && (
            <div className="polar-account-identity">
              <strong>{model.status.email}</strong>
              <span>{model.status.workspaceName}</span>
            </div>
          )}
          {model.operation === "connecting" && model.status.userCode && (
            <div className="polar-device-code" aria-live="polite">
              <span>Enter this code in your browser</span>
              <strong>{model.status.userCode}</strong>
              {model.status.verificationUrl && (
                <button className="text-button" onClick={model.openVerification}>
                  Open verification page ↗
                </button>
              )}
            </div>
          )}
          {model.operation === "connecting" && !model.status.userCode && (
            <p className="provider-notice">Requesting a secure sign-in code…</p>
          )}
          <div className="provider-actions">
            {!model.status.authenticated ? (
              <button className="chatgpt-signin" onClick={model.connect} disabled={model.busy}>
                Continue with Polar
              </button>
            ) : (
              <button className="provider-button" onClick={model.signOut} disabled={model.busy}>
                Sign out of Polar
              </button>
            )}
            {model.operation === "connecting" && (
              <button className="provider-button" onClick={model.cancel}>
                Cancel
              </button>
            )}
            {model.operation === "loading" && (
              <span className="provider-notice">Checking session…</span>
            )}
          </div>
          {model.message && (
            <p className="provider-detail" aria-live="polite">
              {model.message}
            </p>
          )}
          {model.error && (
            <p className="provider-error" role="alert">
              {model.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
