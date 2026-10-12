import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './BottomSheet.module.css';

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  /** Small line above the title, such as the subject and place. */
  eyebrow?: ReactNode;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A panel that slides up from the bottom of the screen. It is a modal dialog: focus stays inside until it closes. */
export function BottomSheet({
  open,
  onClose,
  title,
  closeLabel,
  eyebrow,
  children,
}: BottomSheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const node = panel.current;
    const first =
      node?.querySelector<HTMLElement>('[data-autofocus]') ??
      node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      const list = items.length > 0 ? items : [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = list[0]!;
      const lastItem = list[list.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === firstItem || !node.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (active === lastItem || !node.contains(active))) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const previous = opener.current;
      if (previous instanceof HTMLElement || previous instanceof SVGElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.layer}>
      <div className={styles.backdrop} data-testid="sheet-backdrop" onClick={onClose} />
      <div
        ref={panel}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3,3 L13,13 M13,3 L3,13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
