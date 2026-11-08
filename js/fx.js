// Efeitos: sons sintetizados (Web Audio, sem ficheiros), vibração e confettis.

import { settings } from './storage.js';

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  ok: () => { tone(660, 0, 0.12, 'triangle'); tone(990, 0.08, 0.18, 'triangle'); },
  combo: () => { tone(660, 0, 0.1, 'triangle'); tone(880, 0.07, 0.1, 'triangle'); tone(1320, 0.14, 0.22, 'triangle'); },
  bad: () => { tone(180, 0, 0.25, 'sawtooth', 0.12); tone(140, 0.12, 0.3, 'sawtooth', 0.1); },
  tick: () => tone(1200, 0, 0.05, 'square', 0.05),
  tap: () => tone(500, 0, 0.04, 'sine', 0.06),
  record: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle')),
  badge: () => [784, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.25, 'sine', 0.15)),
  over: () => [440, 349, 262].forEach((f, i) => tone(f, i * 0.18, 0.35, 'triangle', 0.14)),
};

export function sound(name) {
  if (!settings.get().sound) return;
  try { SOUNDS[name]?.(); } catch { /* sem áudio */ }
}

export function vibrate(pattern) {
  if (!settings.get().vibration) return;
  try { navigator.vibrate?.(pattern); } catch { /* nada */ }
}

export const feedback = {
  ok(combo) { sound(combo >= 3 ? 'combo' : 'ok'); vibrate(25); },
  bad() { sound('bad'); vibrate([70, 40, 70]); },
};

// ---------- confettis (canvas por cima de tudo, com delta time) ----------
export function confetti(duration = 2.2) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const g = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  resize();
  const COLORS = ['#7c5cff', '#ff4d8d', '#22d3ee', '#a3e635', '#fbbf24', '#ffffff'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 700,
    vy: -300 - Math.random() * 600,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 12,
    s: 6 + Math.random() * 8,
    col: COLORS[(Math.random() * COLORS.length) | 0],
  }));
  let last = performance.now(), t = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; t += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 900 * dt; p.vx *= 0.99;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      g.save();
      g.globalAlpha = Math.max(0, 1 - t / duration);
      g.translate(p.x, p.y); g.rotate(p.r);
      g.fillStyle = p.col;
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else c.remove();
  }
  requestAnimationFrame(frame);
}
