// Small DOM helpers: screens, toast, confirmation dialog.

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

export type ScreenId = 'menu' | 'setup' | 'rules' | 'game' | 'victory' | 'campaign' | 'level' | 'deck' | 'settings';

export function showScreen(id: ScreenId): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${id}`).classList.add('active');
  window.scrollTo(0, 0);
  $('toast').classList.remove('show');
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string): void {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Custom confirmation dialog: the native confirm() is blocked in embedded viewers
let confirmAction: (() => void) | null = null;
export function askConfirm(text: string, onYes: () => void): void {
  confirmAction = onYes;
  $('confirm-text').textContent = text;
  $('confirm').classList.add('open');
}
function closeConfirm(): void {
  confirmAction = null;
  $('confirm').classList.remove('open');
}
function initConfirm(): void {
  $('confirm-no').onclick = closeConfirm;
  $('confirm-yes').onclick = () => {
    const f = confirmAction;
    closeConfirm();
    f?.();
  };
}

// Info dialog (rewards and other announcements)
let infoClose: (() => void) | null = null;
export function showInfo(html: string, button = 'OK', onClose?: () => void): void {
  $('info-body').innerHTML = html;
  $('info-ok').textContent = button;
  infoClose = onClose ?? null;
  $('info').classList.add('open');
}

export function initDialogs(): void {
  initConfirm();
  $('info-ok').onclick = () => {
    $('info').classList.remove('open');
    const f = infoClose;
    infoClose = null;
    f?.();
  };
}

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
