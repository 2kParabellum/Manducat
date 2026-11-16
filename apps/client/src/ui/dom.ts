// Мелкие помощники для DOM: экраны, всплывающее сообщение, окно подтверждения.

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

export type ScreenId = 'menu' | 'setup' | 'rules' | 'game' | 'victory';

export function showScreen(id: ScreenId): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${id}`).classList.add('active');
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string): void {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Своё окно подтверждения: системный confirm() блокируется во встроенных просмотрщиках
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
export function initConfirm(): void {
  $('confirm-no').onclick = closeConfirm;
  $('confirm-yes').onclick = () => {
    const f = confirmAction;
    closeConfirm();
    f?.();
  };
}

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
