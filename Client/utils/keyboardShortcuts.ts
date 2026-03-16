function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getOpenModalCandidates(): HTMLElement[] {
  const selectors = [
    '.patient-settings-modal',
    '[role="dialog"]',
    '.fixed.inset-0.z-40',
    '.fixed.inset-0.z-50',
    '.fixed.inset-0.z-\[120\]'
  ];

  const seen = new Set<HTMLElement>();
  const all: HTMLElement[] = [];

  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (!seen.has(el) && isVisible(el)) {
        seen.add(el);
        all.push(el);
      }
    });
  });

  return all;
}

function getTopMostModal(): HTMLElement | null {
  const modals = getOpenModalCandidates();
  if (modals.length === 0) return null;

  return modals.sort((a, b) => {
    const zA = Number(window.getComputedStyle(a).zIndex || '0');
    const zB = Number(window.getComputedStyle(b).zIndex || '0');
    return zA - zB;
  })[modals.length - 1] || null;
}

function clickCloseAction(modal: HTMLElement): boolean {
  const closeByLabel = modal.querySelector<HTMLElement>('button[aria-label="Close"]');
  if (closeByLabel && !closeByLabel.hasAttribute('disabled')) {
    closeByLabel.click();
    return true;
  }

  const closeTextPattern = /cancel|close|later|back|deny/i;
  const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
  const closeBtn = buttons.find((btn) => closeTextPattern.test((btn.textContent || '').trim()));
  if (closeBtn) {
    closeBtn.click();
    return true;
  }

  const backdrop = modal.querySelector<HTMLElement>('.absolute.inset-0.cursor-pointer');
  if (backdrop) {
    backdrop.click();
    return true;
  }

  return false;
}

function triggerPrimaryAction(modal: HTMLElement): boolean {
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
    return false;
  }

  if (activeElement) {
    const parentForm = activeElement.closest('form') as HTMLFormElement | null;
    if (parentForm) {
      parentForm.requestSubmit();
      return true;
    }
  }

  const modalForm = modal.querySelector('form') as HTMLFormElement | null;
  if (modalForm) {
    modalForm.requestSubmit();
    return true;
  }

  const prioritySelectors = [
    'button.bg-blue-600:not([disabled])',
    'button.bg-brand-primary:not([disabled])',
    'button.bg-red-600:not([disabled])',
    'button[class*="bg-blue-600"]:not([disabled])',
    'button[class*="bg-brand-primary"]:not([disabled])'
  ];

  for (const selector of prioritySelectors) {
    const btn = modal.querySelector<HTMLButtonElement>(selector);
    if (btn) {
      btn.click();
      return true;
    }
  }

  const actionTextPattern = /save|confirm|grant|approve|submit|login|update|verify|continue|next|done/i;
  const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
  const actionBtn = buttons.find((btn) => actionTextPattern.test((btn.textContent || '').trim()));
  if (actionBtn) {
    actionBtn.click();
    return true;
  }

  return false;
}

export function installGlobalKeyboardShortcuts(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const modal = getTopMostModal();
    if (!modal) return;

    if (event.key === 'Escape') {
      const handled = clickCloseAction(modal);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'BUTTON' || tag === 'A') return;

      const handled = triggerPrimaryAction(modal);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
