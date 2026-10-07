import { Icon } from "@/components/ui/Icon";
import type { Mission } from "@/features/missions/types/mission.types";
export function MissionEvidenceRow({
  item,
  index,
  onClick,
}: {
  item: Mission["evidence"][number];
  index: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button data-evidence-index={index} onClick={onClick}>
      <Icon name="file" size={18} />
      <span>
        <strong>{item.title}</strong>
        <span>
          {item.source} · {item.date}
        </span>
      </span>
      <Icon name="arrow" size={16} />
    </button>
  );
}
