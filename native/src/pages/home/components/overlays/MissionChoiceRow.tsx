import { Icon } from "@/components/ui/Icon";
export function MissionChoiceRow({
  missionId,
  title,
  detail,
  onChoose,
}: {
  missionId: string;
  title: string;
  detail: string;
  onChoose: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button data-mission-id={missionId} onClick={onChoose}>
      <span>
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      <Icon name="arrow" size={18} />
    </button>
  );
}
