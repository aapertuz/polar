export function visibleActionCategory(category?: string): string | undefined {
  const label = category?.trim();
  return label && label.toLowerCase() !== "uncategorized" ? label : undefined;
}
