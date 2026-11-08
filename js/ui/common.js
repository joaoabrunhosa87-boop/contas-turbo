// Peças de interface partilhadas: ecrãs, modais, avisos, seletores e ajuste de tamanho das contas.

import { LEVELS } from '../math/generators.js';
import { solveSteps } from '../math/steps.js';
import { qHTML } from '../math/expr.js';
import { sound } from '../fx.js';

export const $app = () => document.getElementById('app');

let cleanups = [];
export function onLeave(fn) { cleanups.push(fn); }

/** Troca o ecrã atual. Corre as limpezas do ecrã anterior (timers, listeners). */
export function screen(html, cls = '') {
  cleanups.forEach((f) => { try { f(); } catch { /* nada */ } });
  cleanups = [];
  document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
  const app = $app();
  app.innerHTML = `<div class="screen ${cls}">${html}</div>`;
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  return app.firstElementChild;
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function topbar(title, { back = true } = {}) {
  return `<header class="topbar">
    ${back ? '<button class="icon-btn" data-act="back" aria-label="Voltar">‹</button>' : '<span></span>'}
    <h2>${title}</h2><span class="topbar-gap"></span>
  </header>`;
}

export function levelPicker(selected, name = 'lvl') {
  return `<div class="chips level-chips" role="radiogroup" aria-label="Dificuldade">
    ${LEVELS.map((l, i) => `<button class="chip lvl-${i} ${i === selected ? 'on' : ''}" data-${name}="${i}" role="radio" aria-checked="${i === selected}">${l}</button>`).join('')}
  </div>`;
}

/** Liga um grupo de chips de escolha única. */
export function bindChips(root, attr, onChange) {
  root.querySelectorAll(`[data-${attr}]`).forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll(`[data-${attr}]`).forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-checked', 'true');
    sound('tap');
    onChange(b.dataset[attr]);
  }));
}

export function modal(html, { cls = '', dismiss = true } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  const close = () => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 200); };
  if (dismiss) wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  return { el: wrap.firstElementChild, close };
}

const toastQueue = [];
let toasting = false;
export function toast(html, cls = '') {
  toastQueue.push({ html, cls });
  if (!toasting) nextToast();
}
function nextToast() {
  const t = toastQueue.shift();
  if (!t) { toasting = false; return; }
  toasting = true;
  const el = document.createElement('div');
  el.className = `toast ${t.cls}`;
  el.innerHTML = t.html;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => { el.remove(); nextToast(); }, 300); }, 2600);
}

export function achievementToast(a) {
  sound('badge');
  toast(`<span class="toast-icon">${a.icon}</span><div><small>Conquista desbloqueada!</small><b>${a.name}</b></div>`, 'badge');
}

/** Ajusta o tamanho da letra da conta para caber no cartão. */
export function fitMath(el, max = 46, min = 16) {
  if (!el) return;
  let size = max;
  el.style.fontSize = size + 'px';
  const box = el.parentElement;
  const maxH = Math.max(120, box.clientHeight || 220);
  let guard = 40;
  while (guard-- > 0 && size > min && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > maxH)) {
    size -= 2;
    el.style.fontSize = size + 'px';
  }
}

/** Modal "Ver resolução" com a conta passo a passo. */
export function showSteps(q) {
  let steps;
  try { steps = solveSteps(q.tree); } catch { steps = []; }
  const items = steps.map((s, i) => `
    <li class="step ${i === steps.length - 1 ? 'final' : ''}" style="animation-delay:${i * 90}ms">
      <span class="step-label">${i === 0 ? 'Conta' : i === steps.length - 1 ? 'Resultado' : s.label}</span>
      <div class="math step-math">${i === 0 ? '' : '<span class="eq">=</span>'}${s.html}</div>
      ${i > 0 && i === steps.length - 1 && s.label && s.label !== 'Conta' ? `<span class="step-note">${s.label}</span>` : ''}
    </li>`).join('');
  const m = modal(`
    <h3>Resolução passo a passo</h3>
    <p class="muted small">Ordem: parênteses → potências → × e ÷ → + e −</p>
    <ol class="steps">${items}</ol>
    <p class="final-answer">Resposta: <span class="math inline">${qHTML(q.answer)}</span></p>
    <button class="btn primary block" data-close>Percebi!</button>`, { cls: 'steps-modal' });
  return m;
}

export function fmtTime(ms) {
  return (ms / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' s';
}

export function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }); } catch { return ''; }
}
