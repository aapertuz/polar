export const DEFAULT_WINDOW_HEADER_HEIGHT = 78;
export interface Rectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface WindowBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export function getWindowBounds(
  workspace: Rectangle,
  window: Rectangle,
  headerHeight: number = DEFAULT_WINDOW_HEADER_HEIGHT,
): WindowBounds {
  // Permit partial offscreen placement; only a usable strip of the header must remain.
  const visibleWidth = Math.min(160, window.width, workspace.width);
  const visibleHeight = Math.min(48, headerHeight, workspace.height);
  return {
    left: workspace.left + visibleWidth - window.left - window.width,
    right: workspace.left + workspace.width - visibleWidth - window.left,
    top: workspace.top - window.top - Math.max(0, headerHeight - visibleHeight),
    bottom: workspace.top + workspace.height - visibleHeight - window.top,
  };
}
export function clampPosition(position: { x: number; y: number }, bounds: WindowBounds) {
  return {
    x: Math.min(bounds.right, Math.max(bounds.left, position.x)),
    y: Math.min(bounds.bottom, Math.max(bounds.top, position.y)),
  };
}
