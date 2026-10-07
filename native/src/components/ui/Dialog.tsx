import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { AnimatedContent } from "@/components/ui/AnimatedContent";
import { useDialog } from "@/components/ui/hooks/useDialog";

export function Dialog({
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
  const { ref, handleCancel, handleBackdropClick } = useDialog(trigger, onClose);
  return createPortal(
    <dialog
      ref={ref}
      className="demo-dialog"
      aria-labelledby="dialog-title"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <AnimatedContent instant={instant} className="dialog-content">
        <div className="overlay-heading">
          <div>
            <span className="overlay-eyebrow">POLAR / PREVIEW</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close preview" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </AnimatedContent>
    </dialog>,
    document.body,
  );
}
