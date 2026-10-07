import type { Mission } from "@/features/missions/types/mission.types";

export const missions: Mission[] = [
  {
    id: "pilot",
    name: "F1 Pilot",
    outcome: "Run a successful pilot at We Are One with 300 attendees.",
    progress: 60,
    deadline: "Nov 20, 2026",
    days: 16,
    units: { received: 287, target: 300, label: "attendees received" },
    actionCount: 12,
    assessment:
      "Attendee intake is falling behind. At the current pace, interviews will finish 3 days late.",
    recommendation: "You should start calls today with the first 120 confirmed attendees.",
    proposedChange:
      "Start interviews with the confirmed group today. Collect the remaining attendee details in parallel, rather than waiting for the full list.",
    constraint:
      "Complete interviews before Nov 16. Keep the pilot within the agreed event budget and work with the existing organizer team.",
    checkpoints: [
      {
        name: "Pilot scope agreed",
        detail: "Success criteria and event format confirmed with We Are One.",
        status: "Complete",
        date: "Oct 26",
      },
      {
        name: "Organizer team aligned",
        detail: "Owners assigned and the pilot brief shared.",
        status: "Complete",
        date: "Oct 29",
      },
      {
        name: "Interview script ready",
        detail: "A focused script for learning from attendees.",
        status: "Complete",
        date: "Nov 3",
      },
      {
        name: "Attendee interviews complete",
        detail: "Collect enough evidence to shape the event experience.",
        status: "In progress",
        date: "Nov 16",
      },
      {
        name: "Pilot experience ready",
        detail: "Resolve critical findings and confirm event readiness.",
        status: "Upcoming",
        date: "Nov 18",
      },
      {
        name: "Pilot delivered",
        detail: "Run the event and capture what changed for attendees.",
        status: "Upcoming",
        date: "Nov 20",
      },
    ],
    people: [
      { name: "Nick", role: "Event operations", initials: "N" },
      { name: "Sarah", role: "Research", initials: "S" },
      { name: "Antonio", role: "Mission owner", initials: "A" },
    ],
    evidence: [
      { title: "Attendee list · first 120", source: "Uploaded by Nick", date: "Nov 4" },
      { title: "Interview script v2", source: "Shared by Sarah", date: "Nov 4" },
      { title: "We Are One pilot brief", source: "Added by Antonio", date: "Nov 3" },
    ],
    upcoming: [
      {
        title: "Get attendee list",
        timing: "Today",
        priority: "High",
        owner: "N",
        detail:
          "Nick is collecting the remaining attendee details. The first 120 confirmed attendees are already available for calls.",
      },
      {
        title: "Review interview script",
        timing: "Today",
        priority: "Medium",
        owner: "S",
        detail:
          "Review version 2 before the first interviews. Focus on what attendees expect to get from the pilot.",
      },
      {
        title: "Follow up with Joe",
        timing: "Today",
        priority: "Medium",
        owner: "A",
        detail:
          "Confirm the organizer's expectations and resolve the remaining questions about the pilot format.",
      },
      {
        title: "Check Wefter availability",
        timing: "Tomorrow",
        owner: "SH",
        detail: "Confirm support availability for the pilot event on Nov 20.",
      },
    ],
    activity: [
      {
        title: "Nick uploaded 120 attendees",
        timing: "2 hours ago",
        icon: "folder",
        detail: "The first confirmed group is available as context for the pilot.",
      },
      {
        title: "Interview script v2",
        timing: "4 hours ago",
        icon: "file",
        detail: "Sarah shared a revised interview script with clearer questions.",
      },
      {
        title: "Execution plan updated",
        timing: "1 day ago",
        icon: "plus",
        detail: "The sample plan reflects the agreed interview phase and event deadline.",
      },
      {
        title: "You created this mission",
        timing: "1 day ago",
        icon: "plus",
        detail: "F1 Pilot was created from the We Are One event brief.",
      },
      {
        title: "Pilot brief added",
        timing: "1 day ago",
        icon: "file",
        detail:
          "Event format, success criteria, and organizer constraints were collected in one brief.",
      },
    ],
  },
  {
    id: "sales",
    name: "US Sales",
    outcome: "Close 3 paying event organizers.",
    progress: 33,
    deadline: "Nov 30, 2026",
    days: 26,
    units: { received: 1, target: 3, label: "organizers signed" },
    actionCount: 7,
    assessment:
      "Two organizers are waiting on proposals. A clear pilot offer will help move both conversations forward.",
    recommendation: "Send the focused pilot proposal to the two qualified organizers.",
    proposedChange:
      "Bring proposal reviews forward and keep discovery for new prospects in parallel. Prioritize the two qualified organizers.",
    constraint:
      "Use the existing pilot offer. Confirm scope and pricing with the team before making a commitment.",
    checkpoints: [
      {
        name: "Pilot offer defined",
        detail: "A focused offer for independent event organizers.",
        status: "Complete",
        date: "Oct 30",
      },
      {
        name: "Qualified pipeline ready",
        detail: "Three organizers with a clear need and decision owner.",
        status: "In progress",
        date: "Nov 10",
      },
      {
        name: "Three organizers signed",
        detail: "Confirm three paid pilot agreements.",
        status: "Upcoming",
        date: "Nov 30",
      },
    ],
    people: [
      { name: "Antonio", role: "Mission owner", initials: "A" },
      { name: "Joe", role: "Sales", initials: "J" },
    ],
    evidence: [
      { title: "Pilot offer", source: "Shared by Antonio", date: "Oct 30" },
      { title: "Organizer discovery notes", source: "Added by Joe", date: "Nov 3" },
    ],
    upcoming: [
      {
        title: "Review pilot proposal",
        timing: "Today",
        priority: "High",
        owner: "A",
        detail: "Review the offer and terms for the two qualified organizers.",
      },
      {
        title: "Follow up with organizers",
        timing: "Tomorrow",
        priority: "Medium",
        owner: "J",
        detail: "Confirm decision timing and answer questions about the pilot.",
      },
    ],
    activity: [
      {
        title: "First organizer signed",
        timing: "3 hours ago",
        icon: "file",
        detail: "One of the three target organizers confirmed a paid pilot.",
      },
      {
        title: "Discovery notes added",
        timing: "1 day ago",
        icon: "folder",
        detail: "Joe recorded the needs and decision process for two organizers.",
      },
      {
        title: "You created this mission",
        timing: "5 days ago",
        icon: "plus",
        detail: "A focused outcome for validating the US offer.",
      },
    ],
  },
  {
    id: "product",
    name: "Product",
    outcome: "Make the organizer workflow production ready.",
    progress: 70,
    deadline: "Nov 30, 2026",
    days: 26,
    units: { received: 7, target: 10, label: "flows validated" },
    actionCount: 9,
    assessment:
      "The core organizer flow is ready. Three edge cases still need validation before the release.",
    recommendation: "Review the remaining edge cases with the pilot organizer today.",
    proposedChange:
      "Prioritize validation of attendee import, invitation recovery, and event publishing before release polish.",
    constraint:
      "Keep the release focused on the organizer's core journey. Preserve attendee data throughout import and publishing.",
    checkpoints: [
      {
        name: "Core journey mapped",
        detail: "Organizer needs and the critical path agreed.",
        status: "Complete",
        date: "Oct 27",
      },
      {
        name: "Core flows validated",
        detail: "Seven primary flows reviewed with organizers.",
        status: "Complete",
        date: "Nov 3",
      },
      {
        name: "Edge cases validated",
        detail: "Import, recovery, and publishing are reliable.",
        status: "In progress",
        date: "Nov 18",
      },
      {
        name: "Release ready",
        detail: "The organizer journey is production ready.",
        status: "Upcoming",
        date: "Nov 30",
      },
    ],
    people: [
      { name: "Sarah", role: "Product", initials: "S" },
      { name: "Antonio", role: "Engineering", initials: "A" },
    ],
    evidence: [
      { title: "Organizer workflow review", source: "Added by Sarah", date: "Nov 3" },
      { title: "Validation notes", source: "Shared by Antonio", date: "Nov 4" },
    ],
    upcoming: [
      {
        title: "Review attendee import",
        timing: "Today",
        priority: "High",
        owner: "A",
        detail: "Validate incomplete attendee records and repeat imports without losing data.",
      },
      {
        title: "Walk through publishing",
        timing: "Tomorrow",
        priority: "Medium",
        owner: "S",
        detail: "Review publishing with the pilot organizer.",
      },
    ],
    activity: [
      {
        title: "Validation notes shared",
        timing: "1 hour ago",
        icon: "file",
        detail: "The remaining edge cases are recorded in the validation notes.",
      },
      {
        title: "Seven flows validated",
        timing: "1 day ago",
        icon: "plus",
        detail: "Organizers completed the main journey in the sample review.",
      },
      {
        title: "Workflow review added",
        timing: "1 day ago",
        icon: "folder",
        detail: "The current workflow review is available in mission context.",
      },
    ],
  },
];
