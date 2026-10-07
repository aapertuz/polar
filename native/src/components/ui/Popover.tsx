import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { usePopover } from "@/components/ui/hooks/usePopover";

export function Popover({
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
  const { ref, position, motion: motionProps } = usePopover(trigger, instant, onClose);
  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-labelledby="popover-title"
      className="demo-popover"
      style={{ left: position.left, top: position.top, transformOrigin: position.origin }}
      {...motionProps}
    >
      <div className="popover-heading">
        <h2 id="popover-title">{title}</h2>
        <button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      {children}
    </motion.div>,
    document.body,
  );
}
