// 弹窗焦点管理 — ES Module

const modalFocusState = {};

export function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(function(element) { return element.offsetParent !== null; });
}

export function trapModalFocus(modal, event) {
  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modalFocusState[modalId] = document.activeElement;
  modal.classList.remove('hidden');

  const focusable = getFocusableElements(modal);
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  if (!modalFocusState[modalId + 'Keydown']) {
    modalFocusState[modalId + 'Keydown'] = function(event) {
      if (event.key === 'Escape') {
        closeModal(modalId);
        return;
      }
      trapModalFocus(modal, event);
    };
  }

  document.addEventListener('keydown', modalFocusState[modalId + 'Keydown']);
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  if (modalFocusState[modalId + 'Keydown']) {
    document.removeEventListener('keydown', modalFocusState[modalId + 'Keydown']);
  }

  const previousFocus = modalFocusState[modalId];
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
}
