import { Icon } from "@/components/ui/Icon";
import type { Mission } from "@/features/missions/types/mission.types";
export function DocumentOverlayItem({
  item,
  index,
  onClick,
}: {
  item: Mission["evidence"][number];
  index: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button data-document-index={index} onClick={onClick}>
      <Icon name="file" size={18} />
      <span>
        <strong>{item.title}</strong>
        <span>{item.source}</span>
      </span>
    </button>
  );
}
