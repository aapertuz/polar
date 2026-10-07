import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import { ChatgptConnection } from "@/features/providers/components/ChatgptConnection";
interface Props {
  request: OverlayRequest;
  mission: Mission;
  close: () => void;
  select: (id: string, instant?: boolean) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  open: (request: OverlayRequest) => void;
  choose: (id: string) => void;
}
export function SettingsOverlay(_props: Props) {
  return (
    <>
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
