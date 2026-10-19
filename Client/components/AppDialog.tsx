import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Stack of open dialogs so Esc closes only the top one and scroll stays locked until the last closes
const openStack: number[] = [];
let nextId = 1;
let savedOverflow = '';

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small coloured label above the title, e.g. "Danger zone" */
  eyebrow?: React.ReactNode;
  tone?: 'default' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
const TONES = {
  default: 'text-[var(--app-accent)]',
  accent: 'text-[var(--app-accent)]',
  danger: 'text-[var(--app-danger)]',
};

const AppDialog: React.FC<AppDialogProps> = ({ open, onClose, title, subtitle, eyebrow, tone = 'default', size = 'md', children, footer }) => {
  const idRef = useRef(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = nextId++;
    idRef.current = id;
    if (openStack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openStack.push(id);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === id) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    // Move focus into the dialog for keyboard and screen-reader users
    requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      window.removeEventListener('keydown', onKey, true);
      const index = openStack.indexOf(id);
      if (index >= 0) openStack.splice(index, 1);
      if (openStack.length === 0) document.body.style.overflow = savedOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="app-dialog fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6" role="presentation">
      <div className="app-dialog-backdrop absolute inset-0 bg-[rgba(15,20,26,0.55)]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`app-dialog-panel relative flex w-full ${WIDTHS[size]} max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[0_24px_64px_-24px_rgba(15,20,26,0.45)] outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0">
            {eyebrow && <p className={`text-[13px] font-semibold ${TONES[tone]}`}>{eyebrow}</p>}
            <h2 className="mt-1 font-serif text-[24px] font-semibold leading-tight tracking-[-0.015em]">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-muted)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export const DialogButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = ({ variant = 'secondary', className = '', ...rest }) => {
  const styles = {
    primary: 'bg-[var(--app-primary)] text-[var(--app-primary-text)] hover:bg-[var(--app-primary-hover)] border-transparent',
    secondary: 'bg-[var(--app-surface)] text-[var(--app-text)] border-[var(--app-border-strong)] hover:bg-[var(--app-surface-soft)]',
    danger: 'bg-[var(--app-danger)] text-white border-transparent hover:opacity-90',
  };
  return <button type="button" className={`h-10 rounded-full border px-5 text-sm font-semibold transition-colors disabled:opacity-60 ${styles[variant]} ${className}`} {...rest} />;
};

export default AppDialog;
