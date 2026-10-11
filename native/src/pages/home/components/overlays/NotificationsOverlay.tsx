import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import type { AttentionItem } from "@/pages/home/hooks/useBackgroundMissionWorker";
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
  attentionItems: AttentionItem[];
}
export function NotificationsOverlay({ attentionItems, open, choose }: Props) {
  const handleChoose = (item: AttentionItem) => {
    choose(item.missionId);
    if (item.actionId)
      open({
        kind: "action",
        title: item.title,
        action: {
          id: item.actionId,
          timing: "Needs attention",
          owner: "",
          ownerInitials: "",
          status: "upcoming",
        },
      });
  };
  if (attentionItems.length === 0)
    return <p className="overlay-muted">Nothing needs your attention right now.</p>;
  return (
    <>
      {attentionItems.map((item) => (
        <AttentionCard item={item} onChoose={handleChoose} key={item.id} />
      ))}
    </>
  );
}

function AttentionCard({
  item,
  onChoose,
}: {
  item: AttentionItem;
  onChoose: (item: AttentionItem) => void;
}) {
  const handleChoose = () => onChoose(item);
  return (
    <div className="notification-preview">
      <span className="orientation-point" />
      <div>
        <h3>{item.title}</h3>
        <p className="overlay-muted">{item.reason}</p>
      </div>
      <button className="dark-button" onClick={handleChoose}>
        Open action <Icon name="arrow" size={18} />
      </button>
    </div>
  );
}
