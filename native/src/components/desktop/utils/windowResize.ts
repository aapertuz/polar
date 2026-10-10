export const RESIZE_EDGES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type ResizeEdge = (typeof RESIZE_EDGES)[number];
export interface ResizeFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface ResizeLimits {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export function windowResizeLimits(viewport: { width: number; height: number }): ResizeLimits {
  const maxWidth = Math.max(1, viewport.width - 24);
  const maxHeight = Math.max(1, viewport.height - 24);
  return {
    minWidth: Math.min(360, maxWidth),
    minHeight: Math.min(280, maxHeight),
    maxWidth,
    maxHeight,
  };
}

export function resizeWindow(
  frame: ResizeFrame,
  edge: ResizeEdge,
  delta: { x: number; y: number },
  limits: ResizeLimits,
): ResizeFrame {
  const widthDelta = edge.includes("w") ? -delta.x : edge.includes("e") ? delta.x : 0;
  const heightDelta = edge.includes("n") ? -delta.y : edge.includes("s") ? delta.y : 0;
  const width = Math.min(limits.maxWidth, Math.max(limits.minWidth, frame.width + widthDelta));
  const height = Math.min(limits.maxHeight, Math.max(limits.minHeight, frame.height + heightDelta));
  return {
    left: frame.left + (edge.includes("w") ? frame.width - width : 0),
    top: frame.top + (edge.includes("n") ? frame.height - height : 0),
    width,
    height,
  };
}
