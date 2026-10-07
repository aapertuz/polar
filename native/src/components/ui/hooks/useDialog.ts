import { useEffect, useRef } from "react";
export function useDialog(trigger: HTMLElement | undefined, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closeRef.current();
  };
  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeRef.current();
  };
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
  return { ref, handleCancel, handleBackdropClick };
}
