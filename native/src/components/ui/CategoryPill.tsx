import "@/components/ui/category-pill.css";
import { visibleActionCategory } from "@/utils/actionCategory";

export function CategoryPill({
  category,
  tone = "light",
}: {
  category?: string;
  tone?: "light" | "dark";
}) {
  const label = visibleActionCategory(category);
  if (!label) return null;
  return <span className={`category-pill category-pill-${tone}`}>{label}</span>;
}
