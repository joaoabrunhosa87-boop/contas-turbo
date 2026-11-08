// Duelo a 2 jogadores no mesmo telemóvel: ecrã dividido, a metade de cima está rodada 180°.
// Os dois veem a mesma conta; ganha o ponto quem acertar primeiro. Quem erra fica bloqueado
// nessa conta. Usa pointerdown para os dois jogadores poderem tocar ao mesmo tempo.

import { QuestionGen, TYPES, LEVELS } from '../math/generators.js';
import { makeOptions } from '../math/distractors.js';
import { qHTML } from '../math/expr.js';
import { RNG } from '../math/rng.js';
import { settings } from '../storage.js';
import { sound, vibrate, confetti, feedback } from '../fx.js';
import { screen, onLeave, topbar, levelPicker, bindChips, modal, fitMath, showSteps } from './common.js';

const DUEL_SECONDS = 15;

export function duelSetup({ onAchievement, back }) {
  let lvl = Math.min(settings.get().lastLevel, 2), target = 7;
  const root = screen(`
    ${topbar('Duelo')}
    <section class="panel center">
      <div class="big-emoji">⚔️</div>
      <p>Pousem o telemóvel na mesa entre os dois. A mesma conta aparece para os dois lados: <b>quem acertar primeiro ganha o ponto</b>.</p>
      <p class="muted small">Errar bloqueia-te nessa conta. ${DUEL_SECONDS} s por conta.</p>
    </section>
    <section class="panel"><h3>Dificuldade</h3>${levelPicker(lvl)}</section>
    <section class="panel"><h3>Ganha quem chegar a</h3>
      <div class="chips">${[5, 7, 10].map((v) => `<button class="chip ${v === target ? 'on' : ''}" data-tg="${v}">${v} pontos</button>`).join('')}</div>
    </section>
    <button class="btn primary big block" data-act="start">Começar duelo ▶</button>`);
  root.querySelector('[data-act="back"]').addEventListener('click', back);
  bindChips(root, 'lvl', (v) => { lvl = +v; });
  bindChips(root, 'tg', (v) => { target = +v; });
  root.querySelector('[data-act="start"]').addEventListener('click', () => duel({ lvl, target, onAchievement, back }));
}

function duel({ lvl, target, onAchievement, back }) {
  const rng = new RNG();
  const gen = new QuestionGen(rng);
  const types = TYPES.map((t) => t.id).filter((t) => lvl < 2 || t !== 'expr');
  const half = (p) => `
    <div class="duel-half p${p} ${p === 2 ? 'flip' : ''}">
      <div class="duel-head"><b>Jogador ${p}</b><span class="d-score" data-score="${p}">0</span></div>
      <div class="duel-q"><div class="math dq" data-q="${p}"></div></div>
      <div class="duel-opts" data-opts="${p}"></div>
      <div class="d-msg" data-msg="${p}"></div>
    </div>`;
  const root = screen(`
    <div class="duel">
      ${half(2)}
      <div class="duel-mid">
        <button class="icon-btn" data-act="quit" aria-label="Sair">✕</button>
        <div class="d-timer"><div class="fill"></div></div>
        <span class="d-target">até ${target} · ${LEVELS[lvl]}</span>
      </div>
      ${half(1)}
    </div>`, 'duel-screen');

  const score = { 1: 0, 2: 0 };
  let q = null, locked = {}, done = true, timeLeft = DUEL_SECONDS, raf = 0, last = performance.now(), finished = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  onLeave(() => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); });

  root.querySelector('[data-act="quit"]').addEventListener('click', () => back());

  function round() {
    q = gen.makeMixed(types, lvl);
    q.options = makeOptions(q, rng);
    locked = { 1: false, 2: false };
    done = false;
    timeLeft = DUEL_SECONDS;
    for (const p of [1, 2]) {
      const m = root.querySelector(`[data-q="${p}"]`);
      m.innerHTML = q.html;
      fitMath(m, 34, 14);
      root.querySelector(`[data-msg="${p}"]`).textContent = '';
      const opts = root.querySelector(`[data-opts="${p}"]`);
      opts.innerHTML = q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="math">${qHTML(o.value)}</span></button>`).join('');
      opts.querySelectorAll('.opt').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); pick(p, +b.dataset.i, b); }));
    }
    last = performance.now();
  }

  function reveal() {
    for (const p of [1, 2]) {
      root.querySelectorAll(`[data-opts="${p}"] .opt`).forEach((b, j) => {
        b.disabled = true;
        if (q.options[j].correct) b.classList.add('right');
      });
    }
  }

  function msg(p, text, cls = '') {
    const el = root.querySelector(`[data-msg="${p}"]`);
    el.className = `d-msg ${cls}`;
    el.innerHTML = text;
  }

  function pick(p, i, btn) {
    if (done || locked[p]) return;
    const o = q.options[i];
    if (o.correct) {
      done = true;
      score[p]++;
      feedback.ok(0);
      reveal();
      const other = p === 1 ? 2 : 1;
      msg(p, '✅ Ponto!', 'ok');
      msg(other, `Jogador ${p} foi mais rápido`, 'bad');
      const sc = root.querySelector(`[data-score="${p}"]`);
      sc.textContent = score[p];
      sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
      root.querySelector(`.duel-half.p${p}`).classList.add('win-flash');
      later(() => root.querySelector(`.duel-half.p${p}`)?.classList.remove('win-flash'), 600);
      if (score[p] >= target) later(() => finish(p), 1100);
      else later(round, 1300);
    } else {
      locked[p] = true;
      btn.classList.add('wrong');
      feedback.bad();
      msg(p, '❌ Bloqueado nesta conta', 'bad');
      root.querySelectorAll(`[data-opts="${p}"] .opt`).forEach((b) => { b.disabled = true; });
      if (locked[1] && locked[2]) {
        done = true;
        reveal();
        msg(1, 'Ninguém acertou', 'bad'); msg(2, 'Ninguém acertou', 'bad');
        later(round, 1800);
      }
    }
  }

  function finish(winner) {
    finished = true;
    cancelAnimationFrame(raf);
    sound('record');
    vibrate([40, 40, 120]);
    confetti();
    onAchievement?.();
    const lastQ = q;
    const m = modal(`
      <div class="duel-result ${winner === 2 ? 'flip-result' : ''}">
        <div class="big-emoji">🏆</div>
        <h3>Jogador ${winner} ganhou!</h3>
        <p class="duel-final">${score[1]} – ${score[2]}</p>
        <div class="row stack">
          <button class="btn primary big" data-act="again">Revanche</button>
          <button class="btn ghost" data-act="steps">Ver resolução da última</button>
          <button class="btn ghost" data-act="menu">Menu</button>
        </div>
      </div>`, { dismiss: false });
    m.el.querySelector('[data-act="again"]').onclick = () => { m.close(); duel({ lvl, target, onAchievement, back }); };
    m.el.querySelector('[data-act="steps"]').onclick = () => showSteps(lastQ);
    m.el.querySelector('[data-act="menu"]').onclick = () => { m.close(); back(); };
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!done && !finished) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        done = true;
        reveal();
        sound('bad');
        msg(1, '⏰ Tempo!', 'bad'); msg(2, '⏰ Tempo!', 'bad');
        later(round, 1600);
      }
    }
    const fill = root.querySelector('.d-timer .fill');
    if (fill) {
      const f = Math.max(0, timeLeft / DUEL_SECONDS);
      fill.style.transform = `scaleX(${f})`;
      fill.classList.toggle('low', f < 0.25);
    }
    if (!finished) raf = requestAnimationFrame(loop);
  }

  round();
  raf = requestAnimationFrame(loop);
}
