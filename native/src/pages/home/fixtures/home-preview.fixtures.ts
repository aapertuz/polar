import { MISSION_IDS } from "@/features/missions/constants/mission.constants";
export const SAMPLE_CALENDAR = {
  title: "November 2026",
  month: "November",
  year: 2026,
  date: "Wed, Nov 4",
  days: 30,
  today: 4,
  deadline: 20,
  missionId: MISSION_IDS.pilot,
  weekdays: ["S", "M", "T", "W", "T", "F", "S"],
};
export const SAMPLE_NOTIFICATION = {
  missionId: MISSION_IDS.pilot,
  title: "F1 Pilot needs attention",
  detail: "Attendee intake may delay interviews by 3 days.",
  action: "Open F1 Pilot",
};
