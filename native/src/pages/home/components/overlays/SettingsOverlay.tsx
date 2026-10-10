import { ChatgptConnection } from "@/features/providers/components/ChatgptConnection";
import { PolarAccount } from "@/features/application-auth/components/PolarAccount";
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
export function SettingsOverlay({ account }: { account: ReturnType<typeof usePolarAccount> }) {
  return (
    <>
      <PolarAccount model={account} />
      <ChatgptConnection />
      <section className="provider-unavailable" aria-labelledby="claude-heading">
        <div className="provider-heading">
          <h3 id="claude-heading">Claude</h3>
          <span className="provider-status">Unavailable</span>
        </div>
        <p className="overlay-muted">
          Claude subscription connection requires approval from Anthropic for third-party apps.
        </p>
      </section>
      <section className="settings-appearance">
        <div className="appearance-swatch">
          <span />
          <span />
          <span />
        </div>
        <h3>Quiet by design</h3>
        <p className="overlay-muted">
          Warm canvas. Dark mission windows. A single orientation color.
        </p>
        <p className="demo-note">Appearance preview · preferences are not saved.</p>
      </section>
    </>
  );
}
