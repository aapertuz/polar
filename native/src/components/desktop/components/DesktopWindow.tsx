import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { useDesktopWindowModel } from "@/components/desktop/hooks/useDesktopWindowModel";
import type { DesktopWindowProps } from "@/components/desktop/types/desktop.types";

export function DesktopWindow({
  id,
  title,
  header,
  actions,
  children,
  className = "",
  workspace,
  draggable,
  position,
  active,
  onFocus,
  modal = false,
  onDismiss,
  restoreFocusTo,
}: DesktopWindowProps) {
  const model = useDesktopWindowModel({
    id,
    title,
    header,
    actions,
    children,
    className,
    workspace,
    draggable,
    position,
    active,
    onFocus,
    modal,
    onDismiss,
    restoreFocusTo,
  });
  const {
    ref,
    controls,
    bounds,
    dragging,
    moving,
    moveButton,
    x,
    y,
    reduced,
    handleDragStart,
    handleDragEnd,
    handleHeaderPointerDown,
    handleMoveClick,
    handleMoveKeyDown,
    handleMoveBlur,
  } = model;
  return (
    <motion.section
      ref={ref}
      aria-label={`${title} window`}
      role={modal ? "dialog" : undefined}
      aria-modal={modal ? true : undefined}
      data-window={id}
      className={`desktop-window ${className} ${active ? "is-active" : ""} ${dragging ? "is-dragging" : ""}`}
      style={{ x: draggable ? x : 0, y: draggable ? y : 0, zIndex: active ? 15 : 14 }}
      initial={modal && !reduced ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      drag={draggable}
      dragControls={controls}
      dragListener={false}
      dragConstraints={bounds}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
    >
      <header
        className={`window-header ${draggable ? "can-drag" : ""}`}
        onPointerDown={handleHeaderPointerDown}
      >
        <div className="window-header-label">{header}</div>
        <div className="window-header-actions">
          {draggable && (
            <button
              ref={moveButton}
              className="icon-button move-window"
              aria-label={`Move ${title} window`}
              aria-pressed={moving}
              onClick={handleMoveClick}
              onKeyDown={handleMoveKeyDown}
              onBlur={handleMoveBlur}
            >
              <Icon name="move" size={16} />
            </button>
          )}
          {actions}
        </div>
      </header>
      {moving && (
        <div className="move-instructions" role="status">
          Arrow keys to move · Shift for precision · Enter to finish · Esc to cancel
        </div>
      )}
      {children}
    </motion.section>
  );
}
