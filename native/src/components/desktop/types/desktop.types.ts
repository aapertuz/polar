export interface DesktopWindowProps {
  id: string;
  title: string;
  header: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  workspace: RefObject<HTMLElement | null>;
  draggable: boolean;
  position: { x: MotionValue<number>; y: MotionValue<number> };
  active: boolean;
  onFocus: () => void;
  modal?: boolean;
  onDismiss?: () => void;
  restoreFocusTo?: RefObject<HTMLButtonElement | null>;
}
import type { ReactNode, RefObject } from "react";
import type { MotionValue } from "motion/react";
