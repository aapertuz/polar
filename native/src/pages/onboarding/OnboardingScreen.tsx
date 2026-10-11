import { WorkspaceCreateSurface } from "@/features/workspaces/components/WorkspaceCreateSurface";
import { useOnboarding } from "@/pages/onboarding/hooks/useOnboarding";
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import "@/pages/home/styles/home.css";
import "@/pages/onboarding/styles/onboarding.css";

export function OnboardingScreen({ account }: { account: ReturnType<typeof usePolarAccount> }) {
  const model = useOnboarding(account);
  return (
    <main className="onboarding">
      <header className="onboarding-brand">
        <span aria-hidden="true" />
        polar
      </header>
      <section className="onboarding-content" aria-labelledby="onboarding-title">
        <ol className="onboarding-steps" aria-label="Setup progress">
          <li aria-current={!account.status.authenticated ? "step" : undefined}>
            <span>{account.status.authenticated ? "✓" : "01"}</span> Account
          </li>
          <li aria-current={account.status.authenticated ? "step" : undefined}>
            <span>02</span> Workspace
          </li>
        </ol>
        <h1 ref={model.heading} tabIndex={-1} id="onboarding-title">
          {model.loading
            ? "Welcome to Polar."
            : account.status.authenticated
              ? "A place for your next move."
              : "Make your next move clear."}
        </h1>
        {model.loading ? (
          <p role="status" className="onboarding-description">
            Checking your account…
          </p>
        ) : account.status.authenticated ? (
          <>
            <p className="onboarding-description">
              Create your workspace to get started, or choose one you already belong to.
            </p>
            <div className="onboarding-account">
              <span>
                Signed in as <strong>{account.status.email}</strong>
              </span>
              <button
                className="text-button"
                onClick={account.signOut}
                disabled={account.busy || model.workspace.busy}
              >
                Sign out
              </button>
            </div>
            {account.status.workspaces.length > 0 && (
              <label className="onboarding-existing">
                Your workspaces
                <select
                  value=""
                  onChange={model.selectWorkspace}
                  disabled={model.workspace.busy || account.busy}
                >
                  <option value="" disabled>
                    Choose a workspace
                  </option>
                  {account.status.workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <WorkspaceCreateSurface model={model.workspace} close={model.finish} onboarding />
          </>
        ) : (
          <>
            <p className="onboarding-description">
              First, create your Polar account or sign in. Then we’ll set up a workspace for your
              missions.
            </p>
            {account.operation === "connecting" ? (
              <div className="onboarding-connection" role="status">
                <h2>Continue in your browser</h2>
                <p>
                  Create an account or sign in, then approve this desktop. We’ll continue here
                  automatically.
                </p>
                {account.status.userCode ? (
                  <>
                    <span className="onboarding-code-label">Your confirmation code</span>
                    <strong className="onboarding-code">{account.status.userCode}</strong>
                    <button
                      className="dark-button"
                      onClick={account.openVerification}
                      disabled={!account.status.verificationUrl}
                    >
                      Open browser again ↗
                    </button>
                  </>
                ) : (
                  <p>Preparing secure sign-in…</p>
                )}
                <button className="text-button" onClick={account.cancel}>
                  Cancel sign-in
                </button>
              </div>
            ) : (
              <div className="onboarding-start">
                <button
                  className="dark-button"
                  onClick={account.connect}
                  disabled={!account.desktop || account.busy}
                >
                  Create account or sign in <span aria-hidden="true">↗</span>
                </button>
                <p>
                  {account.desktop
                    ? "Opens securely in your browser. Come back here after approving Polar."
                    : "Open the Polar desktop app to create an account or sign in."}
                </p>
              </div>
            )}
          </>
        )}
        {account.error && (
          <p className="workspace-context-error" role="alert">
            {account.error}
          </p>
        )}
      </section>
      <footer className="onboarding-footer">POLAR — MAKE THE NEXT MOVE CLEAR.</footer>
    </main>
  );
}
