import { DesktopWindow } from "@/components/desktop/components/DesktopWindow";
import { MissionWindow } from "@/features/missions/components/MissionWindow";
import { MissionWindowActions } from "@/pages/home/components/MissionWindowActions";
import type { HomeScreenModel } from "@/pages/home/hooks/useHomeScreen";
export function HomeMissionWindow({ model }: { model: HomeScreenModel }) {
  const {
    mission,
    tab,
    selectTab,
    open,
    instant,
    desktopCanvas,
    draggable,
    windows,
    focusMission,
  } = model;
  if (!mission) return null;
  return (
    <DesktopWindow
      id="mission"
      title={mission.name}
      header={
        <>
          <span>{mission.name}</span>
          <span className="breadcrumb-slash">/</span>
          <span>{tab}</span>
        </>
      }
      actions={<MissionWindowActions open={open} />}
      className="mission-window"
      workspace={desktopCanvas}
      draggable={draggable}
      position={windows.mission}
      active={windows.active === "mission"}
      onFocus={focusMission}
    >
      <MissionWindow
        mission={mission}
        tab={tab}
        selectTab={selectTab}
        open={open}
        instant={instant}
      />
    </DesktopWindow>
  );
}
