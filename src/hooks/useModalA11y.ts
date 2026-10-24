import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type ModalOptions = {
  dismissible?: boolean;
  onDismiss?: () => void;
};

const activeModals: HTMLElement[] = [];

function topModal() {
  return activeModals.reduce<HTMLElement | undefined>((top, modal) => {
    if (!top) return modal;
    const layer = Number(window.getComputedStyle(modal).zIndex) || 0;
    const topLayer = Number(window.getComputedStyle(top).zIndex) || 0;
    return layer > topLayer || (layer === topLayer && Boolean(top.compareDocumentPosition(modal) & Node.DOCUMENT_POSITION_FOLLOWING)) ? modal : top;
  }, undefined);
}

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.getClientRects().length > 0);
}

/** Keyboard ownership follows visual stacking; initial focus never commits a decision. */
export function useModalA11y(dialogRef: RefObject<HTMLElement>, options: ModalOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeModals.push(dialog);
    const focusInitial = () => {
      if (topModal() !== dialog) return;
      // Focus the readable dialog itself rather than approve/deny/mode/next controls.
      dialog.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusInitial);
    const onFocusIn = (event: FocusEvent) => {
      if (topModal() === dialog && event.target instanceof Node && !dialog.contains(event.target)) focusInitial();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (topModal() !== dialog) return;
      if (event.key === 'Escape') {
        if (optionsRef.current.dismissible && optionsRef.current.onDismiss) {
          event.preventDefault();
          event.stopImmediatePropagation();
          optionsRef.current.onDismiss();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable(dialog);
      const first = elements[0];
      const last = elements[elements.length - 1];
      const focused = document.activeElement;
      if (!first) {
        event.preventDefault();
        focusInitial();
      } else if (event.shiftKey && (focused === first || focused === dialog || !dialog.contains(focused))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (focused === last || focused === dialog || !dialog.contains(focused))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      const wasTop = topModal() === dialog;
      const index = activeModals.lastIndexOf(dialog);
      if (index >= 0) activeModals.splice(index, 1);
      if (!wasTop) return;
      const remaining = topModal();
      if (previous?.isConnected && (!remaining || remaining.contains(previous))) previous.focus({ preventScroll: true });
      else remaining?.focus({ preventScroll: true });
    };
  }, [dialogRef]);
}
