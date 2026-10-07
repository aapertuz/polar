export type QuickAiIntent = "command" | "new-mission";
export type QuickAiContextKind = "mission" | "source" | "file";

export interface QuickAiContextReference {
  id: string;
  label: string;
  kind: QuickAiContextKind;
}

export type QuickAiResult =
  | { kind: "proposal"; message: string; applied: boolean }
  | { kind: "unsupported"; message: string };

export interface QuickAiDraft {
  text: string;
  context: QuickAiContextReference[];
  result: QuickAiResult | null;
}

export interface QuickAiSession {
  opened: boolean;
  initializedIntents: Record<QuickAiIntent, boolean>;
  intent: QuickAiIntent;
  drafts: Record<QuickAiIntent, QuickAiDraft>;
}

export function createQuickAiSession(): QuickAiSession {
  return {
    opened: false,
    initializedIntents: { command: false, "new-mission": false },
    intent: "command",
    drafts: {
      command: { text: "", context: [], result: null },
      "new-mission": { text: "What are you trying to accomplish?", context: [], result: null },
    },
  };
}

export function openQuickAiSession(
  session: QuickAiSession,
  intent: QuickAiIntent,
  activeMission?: QuickAiContextReference,
): QuickAiSession {
  if (session.initializedIntents[intent]) return { ...session, opened: true, intent };

  return {
    ...session,
    opened: true,
    initializedIntents: { ...session.initializedIntents, [intent]: true },
    intent,
    drafts: {
      ...session.drafts,
      ...(intent === "command" && {
        command: { ...session.drafts.command, context: activeMission ? [activeMission] : [] },
      }),
    },
  };
}

export function closeQuickAiSession(session: QuickAiSession): QuickAiSession {
  return session.opened ? { ...session, opened: false } : session;
}

export function updateQuickAiDraft(session: QuickAiSession, text: string): QuickAiSession {
  const draft = session.drafts[session.intent];
  return {
    ...session,
    drafts: {
      ...session.drafts,
      [session.intent]: { ...draft, text, result: null },
    },
  };
}

export function addQuickAiContext(
  session: QuickAiSession,
  reference: QuickAiContextReference,
): QuickAiSession {
  const draft = session.drafts[session.intent];
  if (draft.context.some((item) => item.id === reference.id)) return session;
  return {
    ...session,
    drafts: {
      ...session.drafts,
      [session.intent]: { ...draft, context: [...draft.context, reference] },
    },
  };
}

export function removeQuickAiContext(session: QuickAiSession, id: string): QuickAiSession {
  const draft = session.drafts[session.intent];
  return {
    ...session,
    drafts: {
      ...session.drafts,
      [session.intent]: { ...draft, context: draft.context.filter((item) => item.id !== id) },
    },
  };
}

export function submitQuickAiPrompt(session: QuickAiSession): QuickAiSession {
  const draft = session.drafts[session.intent];
  if (!draft.text.trim()) return session;

  const result: QuickAiResult =
    session.intent === "command" && draft.text.trim() === "Nick moved the event to Nov 22."
      ? {
          kind: "proposal",
          message: "I can update the deadline and adjust the execution plan. 3 actions will move.",
          applied: false,
        }
      : { kind: "unsupported", message: "Preview is available for the sample deadline update." };

  return {
    ...session,
    drafts: { ...session.drafts, [session.intent]: { ...draft, result } },
  };
}

export function applyQuickAiPreview(session: QuickAiSession): QuickAiSession {
  const draft = session.drafts[session.intent];
  if (draft.result?.kind !== "proposal" || draft.result.applied) return session;
  return {
    ...session,
    drafts: {
      ...session.drafts,
      [session.intent]: { ...draft, result: { ...draft.result, applied: true } },
    },
  };
}
