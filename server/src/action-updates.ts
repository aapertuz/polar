type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

export function missionContextSourceIds(content: unknown): string[] {
  const sourceReferences = asObject(content)?.sourceReferences;
  if (!Array.isArray(sourceReferences)) return [];
  return sourceReferences.flatMap((value) => {
    const id = asObject(value)?.id;
    return typeof id === "string" ? [id] : [];
  });
}

export function withActionDeadline(
  content: unknown,
  checkpointName: string,
  actionTitle: string,
  dueOn: string | null,
): JsonObject | null {
  const record = asObject(content);
  if (!record || !Array.isArray(record.checkpoints)) return null;

  let matches = 0;
  const checkpoints = record.checkpoints.map((checkpointValue) => {
    const checkpoint = asObject(checkpointValue);
    if (checkpoint?.name !== checkpointName || !Array.isArray(checkpoint.actions)) {
      return checkpointValue;
    }
    const actions = checkpoint.actions.map((actionValue) => {
      const action = asObject(actionValue);
      if (action?.title !== actionTitle) return actionValue;
      matches += 1;
      return { ...action, dueOn };
    });
    return { ...checkpoint, actions };
  });

  return matches === 1 ? { ...record, checkpoints } : null;
}
