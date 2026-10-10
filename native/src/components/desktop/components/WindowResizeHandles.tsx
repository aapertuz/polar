import { RESIZE_EDGES } from "@/components/desktop/utils/windowResize";
import type { useWindowResize } from "@/components/desktop/hooks/useWindowResize";

export function WindowResizeHandles({
  title,
  model,
}: {
  title: string;
  model: ReturnType<typeof useWindowResize>;
}) {
  return (
    <>
      {RESIZE_EDGES.map((edge) => (
        <button
          key={edge}
          className={`window-resize-handle window-resize-${edge}`}
          data-resize-edge={edge}
          aria-label={`Resize ${title} window${edge === "se" ? ": arrow keys, Shift for precision" : ` from ${edge}`}`}
          tabIndex={edge === "se" ? 0 : -1}
          onPointerDown={model.handleResizeStart}
          onPointerMove={model.handleResizeMove}
          onPointerUp={model.handleResizeEnd}
          onPointerCancel={model.handleResizeEnd}
          onLostPointerCapture={model.handleResizeEnd}
          onKeyDown={model.handleResizeKeyDown}
        />
      ))}
    </>
  );
}
