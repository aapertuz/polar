import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AnimatedContent } from "@/components/ui/AnimatedContent";
import { Icon } from "@/components/ui/Icon";
import { WindowResizeHandles } from "@/components/desktop/components/WindowResizeHandles";
import { useActionDetailWindow } from "@/features/missions/hooks/useActionDetailWindow";
import "@/components/desktop/styles/window-resize.css";
import "@/features/missions/styles/action-detail.css";

export function ActionDetailWindow({
  title,
  children,
  onClose,
  trigger,
  instant,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  trigger?: HTMLElement;
  instant?: boolean;
}) {
  const model = useActionDetailWindow(trigger, onClose);
  return createPortal(
    <motion.dialog
      ref={model.ref}
      className={`action-detail-window ${model.dragging ? "is-dragging" : ""} ${model.resizing ? "is-resizing" : ""}`}
      aria-label={title}
      style={{ x: model.x, y: model.y, width: model.size?.width, height: model.size?.height }}
      onCancel={model.handleCancel}
      onKeyDown={model.handleKeyDown}
      drag
      dragControls={model.controls}
      dragListener={false}
      dragConstraints={model.bounds}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={model.handleDragStart}
      onDragEnd={model.handleDragEnd}
    >
      <header className="action-window-chrome" onPointerDown={model.handleHeaderPointerDown}>
        <div className="action-traffic-lights">
          <button
            className="action-traffic-close"
            aria-label="Close action details"
            onClick={onClose}
          >
            <Icon name="close" size={10} />
          </button>
          <span className="action-traffic-minimize" aria-hidden="true" />
          <span className="action-traffic-expand" aria-hidden="true" />
        </div>
        <div className="action-chrome-actions">
          <button
            ref={model.moveButton}
            className="icon-button"
            aria-label="Move action details window"
            aria-pressed={model.moving}
            onClick={model.handleMoveClick}
            onKeyDown={model.handleMoveKeyDown}
            onBlur={model.handleMoveBlur}
          >
            <Icon name="move" size={16} />
          </button>
          <button
            className="icon-button action-window-close"
            aria-label="Dismiss action details"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>
      {model.moving && (
        <div className="action-move-instructions" role="status">
          Arrow keys to move · Shift for precision · Enter to finish · Esc to cancel
        </div>
      )}
      <div className="action-window-scroll">
        <AnimatedContent instant={instant} className="action-detail-content">
          {children}
        </AnimatedContent>
      </div>
      <WindowResizeHandles title="action details" model={model} />
    </motion.dialog>,
    document.body,
  );
}
