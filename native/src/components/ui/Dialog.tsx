import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { AnimatedContent } from "./AnimatedContent";

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
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = trigger ?? document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("input[autofocus],input")?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [trigger]);
  return createPortal(
    <dialog
      ref={ref}
      className="demo-dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
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
