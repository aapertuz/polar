export type QuickAiIntent = "command" | "new-mission";
export type QuickAiContextKind = "mission" | "source" | "file";

export interface QuickAiContextReference {
  id: string;
  label: string;
  kind: QuickAiContextKind;
}

export interface QuickAiDraft {
  text: string;
  context: QuickAiContextReference[];
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
      command: { text: "", context: [] },
      "new-mission": { text: "", context: [] },
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
      [session.intent]: { ...draft, text },
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
