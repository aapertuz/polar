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
    reviewingProposal,
    activateReviewedProposal,
    quickAi,
  } = model;
  if (!mission) return null;
  return (
    <DesktopWindow
      id="mission"
      title={mission.name}
      header={
        <>
          <span>{reviewingProposal ? `Draft · ${mission.name}` : mission.name}</span>
          <span className="breadcrumb-slash">/</span>
          <span>{tab}</span>
        </>
      }
      actions={
        <MissionWindowActions
          open={open}
          reviewing={reviewingProposal}
          onActivate={activateReviewedProposal}
          onRefine={quickAi.refine}
          replacingPlan={quickAi.replacingPlan}
          applying={quickAi.chat.loading}
          onRegenerate={model.regeneratePlan}
          generating={model.planGenerating}
        />
      }
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
