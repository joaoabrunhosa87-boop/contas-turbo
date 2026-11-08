// Interface principal: menus, ecrã de jogo, fim de jogo, recordes, estatísticas, conquistas, definições.

import { TYPES, TYPE_BY_ID, LEVELS, questionFromTree } from './math/generators.js';
import { qHTML, fromJSON, toJSON } from './math/expr.js';
import { checkTyped } from './math/answer.js';
import { explainWrong } from './math/distractors.js';
import { Session, comboMult, BLITZ_SECONDS, LIVES, DAILY_SECONDS, DAILY_LEVEL, dailyQuestions, todayStr, hasNegatives } from './game/session.js';
import { ACHIEVEMENTS, checkAchievements } from './game/achievements.js';
import { settings, records, stats, achievements, review, daily, resetAll } from './storage.js';
import { feedback, sound, confetti } from './fx.js';
import {
  screen, onLeave, topbar, levelPicker, bindChips, modal, toast, achievementToast,
  fitMath, showSteps, fmtTime, fmtDate, escapeHTML,
} from './ui/common.js';
import { createKeypad } from './ui/keypad.js';
import { duelSetup } from './ui/duel.js';

// ---------- navegação (o botão "voltar" do telemóvel volta ao menu) ----------
const ROUTES = {};
function go(name, ...args) {
  history.pushState({ name }, '', '#' + name);
  ROUTES[name](...args);
}
window.addEventListener('popstate', () => {
  const name = (location.hash || '#home').slice(1);
  (ROUTES[name] && !['play', 'over', 'duel'].includes(name) ? ROUTES[name] : ROUTES.home)();
});
function bindBack(root) {
  root.querySelector('[data-act="back"]')?.addEventListener('click', () => history.back());
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.get().theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.get().theme === 'light' ? '#f4f3ff' : '#0d0e1f');
}

const MODE_LABEL = {
  'escolha-pergunta': 'Escolha múltipla · por pergunta',
  'escolha-relogio': 'Escolha múltipla · contra-relógio',
  escrita: 'Resposta escrita',
};

// =====================================================================
// MENU PRINCIPAL
// =====================================================================
ROUTES.home = function home() {
  const today = todayStr();
  const d = daily.get(today);
  const nReview = review.list().length;
  const s = stats.get();
  const root = screen(`
    <header class="brand">
      <div class="logo" aria-hidden="true"><span>∑</span></div>
      <h1>Contas<span>Turbo</span></h1>
      <p class="tagline">Treino de cálculo a alta velocidade</p>
    </header>

    <button class="daily-card" data-go="daily">
      <span class="daily-icon">📅</span>
      <span class="daily-txt"><b>Desafio Diário</b>
        <small>${d ? `Feito hoje: ${d.correct}/10 · ${d.score} pts` : '10 contas iguais para toda a gente hoje'}</small></span>
      <span class="daily-go">${d ? '✓' : '▶'}</span>
    </button>

    <div class="mode-grid">
      <button class="mode m1" data-go="setup1"><span class="mode-ic">🎯</span><b>Escolha múltipla</b><small>4 opções · tempo · 3 vidas</small></button>
      <button class="mode m2" data-go="setup2"><span class="mode-ic">✍️</span><b>Resposta escrita</b><small>Contas grandes · teclado</small></button>
      <button class="mode m3" data-go="setupTreino"><span class="mode-ic">🧘</span><b>Treino</b><small>Sem tempo, sem vidas</small></button>
      <button class="mode m4" data-go="duel"><span class="mode-ic">⚔️</span><b>Duelo</b><small>2 jogadores, 1 telemóvel</small></button>
      <button class="mode m5 wide" data-go="review" ${nReview ? '' : 'disabled'}>
        <span class="mode-ic">🔁</span><b>Revisão de erros</b>
        <small>${nReview ? `${nReview} conta${nReview > 1 ? 's' : ''} para voltar a fazer` : 'Ainda não tens erros guardados'}</small></button>
    </div>

    <p class="home-stats">${s.total ? `${s.total} conta${s.total === 1 ? '' : 's'} resolvida${s.total === 1 ? '' : 's'} · ${Math.round((s.ok / s.total) * 100)}% certas · melhor combo ${s.bestCombo}` : 'Escolhe um modo e começa a treinar!'}</p>

    <nav class="bottom-nav">
      <button data-go="records"><span>🏆</span>Recordes</button>
      <button data-go="stats"><span>📊</span>Estatísticas</button>
      <button data-go="badges"><span>🏅</span>Conquistas</button>
      <button data-go="settings"><span>⚙️</span>Definições</button>
    </nav>`, 'home');
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { sound('tap'); go(b.dataset.go); }));
};

// =====================================================================
// CONFIGURAÇÃO DAS PARTIDAS
// =====================================================================
ROUTES.setup1 = function setup1() {
  const st = settings.get();
  let lvl = st.lastLevel, sub = 'pergunta';
  const root = screen(`
    ${topbar('Escolha múltipla')}
    <section class="panel">
      <h3>Dificuldade</h3>${levelPicker(lvl)}
      <p class="muted small level-help"></p>
    </section>
    <section class="panel">
      <h3>Modo de tempo</h3>
      <div class="choice-cards">
        <button class="choice on" data-sub="pergunta"><b>⏱️ Por pergunta</b><small>${st.perQuestion} s para cada conta</small></button>
        <button class="choice" data-sub="relogio"><b>⚡ Contra-relógio</b><small>${BLITZ_SECONDS} s para fazer o máximo</small></button>
      </div>
    </section>
    <section class="panel rules">
      <p>❤️ ${LIVES} vidas · Pontos = base + bónus de rapidez, multiplicados pelo combo de certas seguidas.</p>
      <p class="muted small">As opções erradas são erros típicos — cuidado com as rasteiras!</p>
    </section>
    <button class="btn primary big block" data-act="start">Começar ▶</button>`);
  bindBack(root);
  const help = root.querySelector('.level-help');
  const setHelp = () => { help.textContent = LEVEL_HELP[lvl]; };
  setHelp();
  bindChips(root, 'lvl', (v) => { lvl = +v; settings.set({ lastLevel: lvl }); setHelp(); });
  bindChips(root, 'sub', (v) => { sub = v; });
  root.querySelector('[data-act="start"]').addEventListener('click', () => {
    go('play', {
      mode: 'escolha', sub, lvl, types: TYPES.map((t) => t.id), answer: 'escolha',
      lives: LIVES, perQ: sub === 'pergunta' ? st.perQuestion : null, total: sub === 'relogio' ? BLITZ_SECONDS : null,
    });
  });
};

const LEVEL_HELP = [
  'Números pequenos, uma ou duas operações.',
  'Números maiores, divisões, potências com sinais.',
  'Várias operações, frações e parênteses.',
  'Contas enormes, parênteses dentro de parênteses. Boa sorte!',
];

const WRITTEN_TIMES = [[60, '60 s'], [90, '90 s'], [120, '2 min'], [0, 'Sem tempo']];

ROUTES.setup2 = function setup2() {
  const st = settings.get();
  let lvl = st.lastLevel;
  const root = screen(`
    ${topbar('Resposta escrita')}
    <section class="panel">
      <h3>Dificuldade</h3>${levelPicker(lvl)}
      <p class="muted small level-help">${LEVEL_HELP[lvl]}</p>
    </section>
    <section class="panel">
      <h3>Tempo por conta</h3>
      <div class="chips">${WRITTEN_TIMES.map(([v, l]) => `<button class="chip ${v === st.writtenTime ? 'on' : ''}" data-wt="${v}">${l}</button>`).join('')}</div>
    </section>
    <section class="panel rules">
      <p>✍️ Escreve a resposta com o teclado do ecrã. Botão <b>a/b</b> para frações.</p>
      <p class="muted small">${st.requireSimplified ? 'Tens de simplificar (definições).' : 'Respostas equivalentes contam (6/8 = 3/4).'}</p>
    </section>
    <button class="btn primary big block" data-act="start">Começar ▶</button>`);
  bindBack(root);
  bindChips(root, 'lvl', (v) => { lvl = +v; settings.set({ lastLevel: lvl }); root.querySelector('.level-help').textContent = LEVEL_HELP[lvl]; });
  bindChips(root, 'wt', (v) => settings.set({ writtenTime: +v }));
  root.querySelector('[data-act="start"]').addEventListener('click', () => {
    const wt = settings.get().writtenTime;
    go('play', { mode: 'escrita', lvl, types: ['expr', 'expr', 'fexp'], answer: 'escrita', lives: LIVES, perQ: wt || null });
  });
};

ROUTES.setupTreino = function setupTreino() {
  const st = settings.get();
  let lvl = st.lastLevel, answer = 'escolha';
  const chosen = new Set(['neg']);
  const root = screen(`
    ${topbar('Treino')}
    <section class="panel">
      <h3>O que queres treinar?</h3>
      <div class="type-list">${TYPES.map((t) => `
        <button class="type-btn ${chosen.has(t.id) ? 'on' : ''}" data-type="${t.id}">
          <span class="type-ic">${t.icon}</span><span>${t.name}</span><span class="check">✓</span></button>`).join('')}
      </div>
    </section>
    <section class="panel"><h3>Dificuldade</h3>${levelPicker(lvl)}</section>
    <section class="panel">
      <h3>Responder com</h3>
      <div class="choice-cards">
        <button class="choice on" data-ans="escolha"><b>🎯 Escolha múltipla</b><small>4 opções</small></button>
        <button class="choice" data-ans="escrita"><b>✍️ Teclado</b><small>Escreves tu</small></button>
      </div>
    </section>
    <button class="btn primary big block" data-act="start">Treinar ▶</button>`);
  bindBack(root);
  root.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.type;
    if (chosen.has(id) && chosen.size > 1) chosen.delete(id); else chosen.add(id);
    b.classList.toggle('on', chosen.has(id));
    sound('tap');
  }));
  bindChips(root, 'lvl', (v) => { lvl = +v; settings.set({ lastLevel: lvl }); });
  bindChips(root, 'ans', (v) => { answer = v; });
  root.querySelector('[data-act="start"]').addEventListener('click', () => {
    go('play', { mode: 'treino', lvl, types: [...chosen], answer, lives: Infinity, perQ: null });
  });
};

// =====================================================================
// DESAFIO DIÁRIO
// =====================================================================
ROUTES.daily = function dailyScreen() {
  const today = todayStr();
  const d = daily.get(today);
  const dateLabel = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  const root = screen(`
    ${topbar('Desafio Diário')}
    <section class="panel center">
      <div class="big-emoji">📅</div>
      <h3 class="cap">${dateLabel}</h3>
      <p>As mesmas <b>10 contas</b> para toda a gente hoje. Compara com os teus amigos!</p>
      <p class="muted small">Nível ${LEVELS[DAILY_LEVEL]} · ${DAILY_SECONDS} s por conta · sem vidas</p>
    </section>
    ${d ? `<section class="panel center">
      <p class="muted">O teu resultado de hoje</p>
      <div class="daily-score">${d.score} <small>pts</small></div>
      <div class="emoji-grid">${d.grid.map((g) => (g ? '🟩' : '🟥')).join('')}</div>
      <p>${d.correct}/10 certas</p>
      <button class="btn primary block" data-act="share">Partilhar resultado</button>
    </section>
    <button class="btn ghost block" data-act="practice">Voltar a fazer (não conta)</button>`
    : '<button class="btn primary big block" data-act="start">Começar desafio ▶</button>'}`);
  bindBack(root);
  const cfg = (practice) => ({
    mode: practice ? 'treino' : 'diario', lvl: DAILY_LEVEL, types: [], answer: 'escolha',
    lives: Infinity, perQ: DAILY_SECONDS, preset: dailyQuestions(today), dailyDate: today,
  });
  root.querySelector('[data-act="start"]')?.addEventListener('click', () => go('play', cfg(false)));
  root.querySelector('[data-act="practice"]')?.addEventListener('click', () => go('play', cfg(true)));
  root.querySelector('[data-act="share"]')?.addEventListener('click', () => shareDaily(today, d));
};

async function shareDaily(date, d) {
  const text = `Contas Turbo · Desafio Diário ${date}\n${d.grid.map((g) => (g ? '🟩' : '🟥')).join('')}\n${d.correct}/10 · ${d.score} pontos`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    toast('📋 Copiado! Cola na conversa com os teus amigos.');
  } catch { /* cancelado */ }
}

// =====================================================================
// REVISÃO DE ERROS
// =====================================================================
ROUTES.review = function reviewScreen() {
  const list = review.list();
  if (!list.length) { ROUTES.home(); return; }
  const root = screen(`
    ${topbar('Revisão de erros')}
    <section class="panel">
      <p>Tens <b>${list.length}</b> conta${list.length > 1 ? 's' : ''} que erraste. Ao acertares, sai da lista.</p>
      <ul class="review-list">${list.slice(0, 30).map((x) => `
        <li><span class="tag t-${x.type}">${TYPE_BY_ID[x.type]?.name || ''}</span>
        <div class="math small-math">${questionFromTree(fromJSON(x.tree), x.type, x.lvl).html}</div></li>`).join('')}
      </ul>
    </section>
    <section class="panel">
      <h3>Responder com</h3>
      <div class="choice-cards">
        <button class="choice on" data-ans="escrita"><b>✍️ Teclado</b><small>Mais difícil, aprende-se mais</small></button>
        <button class="choice" data-ans="escolha"><b>🎯 Escolha múltipla</b><small>4 opções</small></button>
      </div>
    </section>
    <button class="btn primary big block" data-act="start">Rever ▶</button>`);
  bindBack(root);
  let answer = 'escrita';
  bindChips(root, 'ans', (v) => { answer = v; });
  root.querySelectorAll('.small-math').forEach((m) => fitMath(m, 22, 12));
  root.querySelector('[data-act="start"]').addEventListener('click', () => {
    const preset = review.list().slice(0, 15).map((x) => questionFromTree(fromJSON(x.tree), x.type, x.lvl));
    go('play', { mode: 'revisao', lvl: 0, types: [], answer, lives: Infinity, perQ: null, preset });
  });
};

// =====================================================================
// JOGO
// =====================================================================
ROUTES.play = function play(cfg) {
  if (!cfg) { ROUTES.home(); return; }
  const session = new Session(cfg);
  const st = settings.get();
  const unlimited = !Number.isFinite(cfg.lives);
  const root = screen(`
    <div class="hud">
      <button class="icon-btn" data-act="quit" aria-label="Sair">✕</button>
      <div class="lives" aria-label="Vidas">${unlimited ? '<span class="inf">∞</span>' : '<span class="heart">❤</span>'.repeat(cfg.lives)}</div>
      <div class="score-box"><small>Pontos</small><b class="score">0</b></div>
      <div class="combo-box"><b class="combo">×1</b><small class="combo-n">combo 0</small></div>
    </div>
    <div class="timebar ${cfg.perQ || cfg.total ? '' : 'hidden'}"><div class="fill"></div><span class="time-txt"></span></div>
    <div class="qmeta"><span class="tag qtype"></span><span class="qnum"></span></div>
    <div class="qcard"><div class="math qmath"></div><div class="float-layer"></div></div>
    <div class="feedback" aria-live="polite"></div>
    <div class="answers"></div>`, `play mode-${cfg.mode}`);

  const $ = (s) => root.querySelector(s);
  const answersEl = $('.answers');
  const fb = $('.feedback');
  let state = 'asking';
  let keypad = null;
  let raf = 0, last = performance.now(), lastTickSec = null;

  if (cfg.answer === 'escrita') {
    answersEl.classList.add('written');
    keypad = createKeypad(answersEl, { onSubmit: onTyped, onKey: () => sound('tap') });
    onLeave(() => keypad.destroy());
  }

  $('[data-act="quit"]').addEventListener('click', () => {
    if (session.history.length === 0) { history.back(); return; }
    state = 'paused';
    const m = modal(`<h3>Sair da partida?</h3>
      <p class="muted">${unlimited ? 'Vês o resumo do treino.' : 'A partida acaba aqui com os pontos que tens.'}</p>
      <div class="row"><button class="btn ghost" data-act="no">Continuar</button><button class="btn danger" data-act="yes">Sair</button></div>`, { dismiss: false });
    m.el.querySelector('[data-act="no"]').onclick = () => { m.close(); state = 'asking'; last = performance.now(); };
    m.el.querySelector('[data-act="yes"]').onclick = () => { m.close(); session.over = true; endGame(session); };
  });

  function nextQ() {
    const q = session.nextQuestion();
    if (!q) { endGame(session); return; }
    state = 'asking';
    lastTickSec = null;
    fb.innerHTML = '';
    fb.className = 'feedback';
    $('.qtype').textContent = TYPE_BY_ID[q.type]?.name || '';
    $('.qtype').className = `tag qtype t-${q.type}`;
    $('.qnum').textContent = cfg.preset ? `${session.index}/${cfg.preset.length}` : `#${session.index}`;
    const math = $('.qmath');
    math.innerHTML = q.html;
    math.classList.remove('pop'); void math.offsetWidth; math.classList.add('pop');
    fitMath(math, q.text.length > 28 ? 40 : 52);
    if (cfg.answer === 'escolha') {
      answersEl.innerHTML = q.options.map((o, i) => `
        <button class="opt" data-i="${i}"><span class="math">${qHTML(o.value)}</span></button>`).join('');
      answersEl.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => onPick(+b.dataset.i, b)));
    } else {
      keypad.clear();
      keypad.lock(false);
    }
    last = performance.now();
  }

  function onPick(i, btn) {
    if (state !== 'asking') return;
    const opt = session.q.options[i];
    answersEl.querySelectorAll('.opt').forEach((b, j) => {
      b.disabled = true;
      if (session.q.options[j].correct) b.classList.add('right');
    });
    if (!opt.correct) btn.classList.add('wrong');
    resolve(opt.correct, { picked: opt.value, why: opt.why });
  }

  function onTyped(typed) {
    if (state !== 'asking') return;
    const r = checkTyped(typed, session.q.answer, settings.get().requireSimplified);
    if (r.status === 'invalido') {
      keypad.shake();
      fb.className = 'feedback warn';
      fb.innerHTML = `<p>${r.message}</p>`;
      return;
    }
    keypad.lock(true);
    let note = null;
    if (r.status === 'certoNaoSimplificado') note = `Certo! Simplificado fica <span class="math inline">${qHTML(session.q.answer)}</span>`;
    let why = null;
    if (r.status === 'errado') {
      why = r.message || explainWrong(session.q.tree, session.q.answer, r.value);
    }
    resolve(r.status !== 'errado', { picked: r.value, why, note });
  }

  function resolve(correct, { picked = null, why = null, note = null, timeout = false } = {}) {
    state = 'feedback';
    const q = session.q;
    const res = session.submit(correct, { picked: picked?.toString(), timeout });
    const s = stats.record(q.type, correct, res.ms, session.combo, hasNegatives(q.tree));
    // revisão de erros
    if (cfg.mode === 'revisao') {
      if (correct) { review.remove(q.text); s.reviewFixed++; stats.save(s); }
    } else if (!correct) {
      review.add({ tree: toJSON(q.tree), type: q.type, lvl: q.lvl, text: q.text, date: new Date().toISOString() });
    }
    checkAchievements({ event: 'answer', stats: s, session, correct, ms: res.ms }).forEach(achievementToast);
    updateHud(correct);

    if (correct) {
      feedback.ok(session.combo);
      floatPoints(res);
      fb.className = 'feedback ok';
      fb.innerHTML = `<p>${note || pickPraise(res.ms)}</p>`;
      root.classList.remove('flash-bad'); root.classList.add('flash-ok');
      setTimeout(() => root.classList.remove('flash-ok'), 400);
      setTimeout(() => (session.over ? endGame(session) : nextQ()), note ? 1600 : 800);
    } else {
      feedback.bad();
      root.classList.add('flash-bad', 'shake');
      setTimeout(() => root.classList.remove('flash-bad', 'shake'), 450);
      fb.className = 'feedback bad';
      fb.innerHTML = `
        <p><b>${timeout ? '⏰ Tempo esgotado!' : 'Errado!'}</b> A resposta é <span class="math inline">${qHTML(q.answer)}</span></p>
        ${why ? `<p class="why">💡 ${why}</p>` : ''}
        <div class="row">
          <button class="btn ghost" data-act="steps">Ver resolução</button>
          <button class="btn primary" data-act="next">${session.over ? 'Ver resultado' : 'Continuar →'}</button>
        </div>`;
      fb.querySelector('[data-act="steps"]').onclick = () => showSteps(q);
      fb.querySelector('[data-act="next"]').onclick = () => (session.over ? endGame(session) : nextQ());
    }
  }

  function pickPraise(ms) {
    if (ms < 2000) return '⚡ Relâmpago!';
    const p = ['Certo!', 'Boa!', 'Muito bem!', 'Isso mesmo!', 'Exato!'];
    return p[Math.floor(Math.random() * p.length)];
  }

  function floatPoints(res) {
    if (!res.points) return;
    const el = document.createElement('div');
    el.className = 'float-pts';
    el.innerHTML = `+${res.points}${res.mult > 1 ? ` <small>×${res.mult}</small>` : ''}`;
    $('.float-layer').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function updateHud(correct) {
    $('.score').textContent = session.score.toLocaleString('pt-PT');
    if (!unlimited) {
      const hearts = root.querySelectorAll('.heart');
      hearts.forEach((h, i) => h.classList.toggle('lost', i >= session.lives));
      if (!correct) hearts[session.lives]?.classList.add('break');
    }
    $('.combo').textContent = '×' + String(comboMult(session.combo)).replace('.', ',');
    $('.combo-n').textContent = `combo ${session.combo}`;
    const cb = $('.combo-box');
    cb.classList.toggle('hot', session.combo >= 3);
    if (correct && session.combo >= 3) { cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump'); }
  }

  function updateTimer() {
    const fill = $('.timebar .fill');
    const txt = $('.time-txt');
    let left = null, tot = null;
    if (cfg.total) { left = session.timeLeftTotal; tot = cfg.total; } else if (cfg.perQ) { left = session.timeLeftQ; tot = cfg.perQ; }
    if (left == null) return;
    const frac = Math.max(0, left / tot);
    fill.style.transform = `scaleX(${frac})`;
    fill.classList.toggle('low', frac < 0.25);
    txt.textContent = `${Math.ceil(left)} s`;
    const sec = Math.ceil(left);
    if (sec <= 3 && sec > 0 && sec !== lastTickSec && state === 'asking') { lastTickSec = sec; sound('tick'); }
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state === 'asking') {
      const ev = session.tick(dt);
      if (ev === 'total') { state = 'done'; updateTimer(); endGame(session); return; }
      if (ev === 'pergunta') {
        if (cfg.answer === 'escolha') {
          answersEl.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (session.q.options[j].correct) b.classList.add('right'); });
        } else keypad.lock(true);
        resolve(false, { timeout: true });
      }
    }
    updateTimer();
    raf = requestAnimationFrame(loop);
  }

  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); });

  updateHud(true);
  nextQ();
  raf = requestAnimationFrame(loop);
};

// =====================================================================
// FIM DE JOGO
// =====================================================================
function endGame(session) {
  const cfg = session.cfg;
  const s = stats.get();
  s.games++;
  stats.save(s);
  const fresh = checkAchievements({ event: 'end', stats: s, session });

  if (cfg.mode === 'diario') {
    daily.set(cfg.dailyDate, { score: session.score, correct: session.correct, grid: session.history.map((h) => h.correct) });
  }
  history.replaceState({ name: 'over' }, '', '#over');
  ROUTES.over(session);
  fresh.forEach(achievementToast);

  const key = session.key;
  if (MODE_LABEL[key] && records.qualifies(key, cfg.lvl, session.score)) {
    setTimeout(() => newRecord(session), 500);
  } else if (session.history.length) {
    sound('over');
  }
}

function newRecord(session) {
  const key = session.key;
  const lvl = session.cfg.lvl;
  const list = records.list(key, lvl);
  const pos = list.filter((r) => r.score >= session.score).length + 1;
  sound('record');
  confetti();
  const m = modal(`
    <div class="record-anim"><div class="trophy">🏆</div><div class="rays"></div></div>
    <h3 class="record-title">Novo recorde!</h3>
    <p class="record-pos">${pos}.º lugar · ${LEVELS[lvl]}</p>
    <div class="record-score">${session.score.toLocaleString('pt-PT')} <small>pts</small></div>
    <label class="field"><span>O teu nome ou alcunha</span>
      <input type="text" maxlength="14" autocomplete="nickname" value="${escapeHTML(settings.get().lastName)}" placeholder="Ex.: Mestre das Contas">
    </label>
    <button class="btn primary big block" data-act="save">Guardar</button>`, { cls: 'record-modal', dismiss: false });
  const input = m.el.querySelector('input');
  setTimeout(() => input.focus(), 300);
  const save = () => {
    const name = input.value.trim() || 'Anónimo';
    settings.set({ lastName: name });
    records.add(key, lvl, { name, score: session.score, correct: session.correct, combo: session.bestCombo, date: new Date().toISOString() });
    m.close();
    toast('🏆 Recorde guardado!');
  };
  m.el.querySelector('[data-act="save"]').onclick = save;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

ROUTES.over = function over(session) {
  if (!session) { ROUTES.home(); return; }
  const cfg = session.cfg;
  const n = session.history.length;
  const acc = n ? Math.round((session.correct / n) * 100) : 0;
  const wrongs = session.history.filter((h) => !h.correct);
  const title = cfg.mode === 'treino' ? 'Fim do treino' : cfg.mode === 'revisao' ? 'Revisão feita' :
    cfg.mode === 'diario' ? 'Desafio concluído!' : session.timeLeftTotal === 0 ? 'Tempo!' : 'Fim de jogo';
  const root = screen(`
    <h2 class="over-title">${title}</h2>
    <div class="over-score"><small>${MODE_LABEL[session.key] || (cfg.mode === 'diario' ? 'Desafio Diário' : 'Pontos')}${cfg.mode === 'revisao' ? '' : ' · ' + LEVELS[cfg.lvl]}</small>
      <b>${session.score.toLocaleString('pt-PT')}</b></div>
    ${cfg.mode === 'diario' ? `<div class="emoji-grid">${session.history.map((h) => (h.correct ? '🟩' : '🟥')).join('')}</div>` : ''}
    <div class="stat-row">
      <div class="stat"><b>${session.correct}/${n}</b><small>certas</small></div>
      <div class="stat"><b>${acc}%</b><small>acerto</small></div>
      <div class="stat"><b>${session.bestCombo}</b><small>melhor combo</small></div>
      <div class="stat"><b>${fmtTime(session.avgMs())}</b><small>tempo médio</small></div>
    </div>
    ${wrongs.length ? `<section class="panel"><h3>Contas que falhaste</h3><ul class="wrong-list">
      ${wrongs.map((h, i) => `<li><div class="math small-math">${h.q.html}</div>
        <div class="wl-ans">= <span class="math inline">${qHTML(h.q.answer)}</span></div>
        <button class="btn tiny ghost" data-steps="${i}">Ver resolução</button></li>`).join('')}
    </ul></section>` : n ? '<p class="center perfect">✨ Sem erros! ✨</p>' : ''}
    <div class="row stack">
      ${cfg.mode === 'diario' ? '<button class="btn primary big" data-act="share">Partilhar</button>' : '<button class="btn primary big" data-act="again">Jogar outra vez</button>'}
      <button class="btn ghost big" data-act="menu">Menu</button>
    </div>`, 'over');
  root.querySelectorAll('.small-math').forEach((m) => fitMath(m, 22, 11));
  root.querySelectorAll('[data-steps]').forEach((b) => b.addEventListener('click', () => showSteps(wrongs[+b.dataset.steps].q)));
  root.querySelector('[data-act="menu"]').addEventListener('click', () => { history.replaceState({}, '', '#home'); ROUTES.home(); });
  root.querySelector('[data-act="again"]')?.addEventListener('click', () => {
    const again = { ...cfg };
    delete again.rng;
    if (cfg.mode === 'revisao') {
      if (!review.list().length) { ROUTES.home(); return; }
      again.preset = review.list().slice(0, 15).map((x) => questionFromTree(fromJSON(x.tree), x.type, x.lvl));
    } else if (cfg.preset) {
      again.preset = dailyQuestions(cfg.dailyDate);
    }
    history.replaceState({ name: 'play' }, '', '#play');
    ROUTES.play(again);
  });
  root.querySelector('[data-act="share"]')?.addEventListener('click', () => shareDaily(cfg.dailyDate, daily.get(cfg.dailyDate)));
};

// =====================================================================
// RECORDES
// =====================================================================
ROUTES.records = function recordsScreen() {
  let mode = 'escolha-pergunta', lvl = settings.get().lastLevel;
  const root = screen(`
    ${topbar('Recordes')}
    <div class="tabs" role="tablist">
      <button class="tab on" data-mode="escolha-pergunta">Por pergunta</button>
      <button class="tab" data-mode="escolha-relogio">Contra-relógio</button>
      <button class="tab" data-mode="escrita">Escrita</button>
      <button class="tab" data-mode="diario">Diário</button>
    </div>
    <div class="lvl-wrap">${levelPicker(lvl)}</div>
    <div class="record-table"></div>`);
  bindBack(root);
  const table = root.querySelector('.record-table');
  const lvlWrap = root.querySelector('.lvl-wrap');
  function render() {
    lvlWrap.style.display = mode === 'diario' ? 'none' : '';
    if (mode === 'diario') {
      const all = Object.entries(daily.all()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 20);
      table.innerHTML = all.length ? `<ol class="records daily-hist">${all.map(([date, d]) => `
        <li><span class="r-name">${fmtDate(date + 'T12:00')}</span><span class="emoji-mini">${d.grid.map((g) => (g ? '🟩' : '🟥')).join('')}</span><b>${d.score}</b></li>`).join('')}</ol>`
        : '<p class="empty-state">Ainda não fizeste nenhum Desafio Diário.</p>';
      return;
    }
    const list = records.list(mode, lvl);
    table.innerHTML = list.length ? `<ol class="records">${list.map((r, i) => `
      <li class="${i < 3 ? 'top' + (i + 1) : ''}"><span class="r-pos">${['🥇', '🥈', '🥉'][i] || i + 1 + '.º'}</span>
        <span class="r-name">${escapeHTML(r.name)}<small>${r.correct} certas · combo ${r.combo} · ${fmtDate(r.date)}</small></span>
        <b>${r.score.toLocaleString('pt-PT')}</b></li>`).join('')}</ol>`
      : `<p class="empty-state">Ainda não há recordes em ${LEVELS[lvl]}.<br>Vai jogar! 🚀</p>`;
  }
  bindChips(root, 'mode', (v) => { mode = v; render(); });
  bindChips(root, 'lvl', (v) => { lvl = +v; render(); });
  render();
};

// =====================================================================
// ESTATÍSTICAS
// =====================================================================
ROUTES.stats = function statsScreen() {
  const s = stats.get();
  const acc = s.total ? Math.round((s.ok / s.total) * 100) : 0;
  const root = screen(`
    ${topbar('Estatísticas')}
    <div class="stat-row">
      <div class="stat"><b>${s.total}</b><small>contas resolvidas</small></div>
      <div class="stat"><b>${acc}%</b><small>acerto total</small></div>
      <div class="stat"><b>${s.bestCombo}</b><small>melhor combo</small></div>
      <div class="stat"><b>${s.total ? fmtTime(s.ms / s.total) : '—'}</b><small>tempo médio</small></div>
    </div>
    <section class="panel">
      <h3>Por tipo de conta</h3>
      <ul class="type-stats">${TYPES.map((t) => {
        const b = s.byType[t.id] || { n: 0, ok: 0, ms: 0 };
        const p = b.n ? Math.round((b.ok / b.n) * 100) : 0;
        return `<li><div class="ts-head"><span class="type-ic">${t.icon}</span><b>${t.name}</b><span class="ts-pct">${b.n ? p + '%' : '—'}</span></div>
          <div class="bar"><div class="bar-fill t-${t.id}" style="width:${p}%"></div></div>
          <small class="muted">${b.ok}/${b.n} certas · ${b.n ? fmtTime(b.ms / b.n) : '—'} em média</small></li>`;
      }).join('')}</ul>
    </section>
    <p class="muted small center">${s.games} partidas jogadas · ${s.reviewFixed} erros corrigidos na revisão</p>`);
  bindBack(root);
};

// =====================================================================
// CONQUISTAS
// =====================================================================
ROUTES.badges = function badgesScreen() {
  const got = achievements.get();
  const n = Object.keys(got).length;
  const root = screen(`
    ${topbar('Conquistas')}
    <p class="center muted">${n} de ${ACHIEVEMENTS.length} desbloqueadas</p>
    <div class="bar big-bar"><div class="bar-fill" style="width:${(n / ACHIEVEMENTS.length) * 100}%"></div></div>
    <div class="badge-grid">${ACHIEVEMENTS.map((a) => `
      <div class="badge ${got[a.id] ? 'got' : 'locked'}">
        <span class="badge-ic">${got[a.id] ? a.icon : '🔒'}</span>
        <b>${a.name}</b><small>${a.desc}</small>
        ${got[a.id] ? `<span class="badge-date">${fmtDate(got[a.id])}</span>` : ''}
      </div>`).join('')}</div>`);
  bindBack(root);
};

// =====================================================================
// DEFINIÇÕES
// =====================================================================
ROUTES.settings = function settingsScreen() {
  const st = settings.get();
  const toggle = (k, label, sub) => `
    <label class="toggle-row"><span><b>${label}</b><small>${sub}</small></span>
      <input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><span class="switch" aria-hidden="true"></span></label>`;
  const root = screen(`
    ${topbar('Definições')}
    <section class="panel">
      ${toggle('sound', 'Sons', 'Ao acertar, errar e no fim do tempo')}
      ${toggle('vibration', 'Vibração', 'Em telemóveis que suportem')}
      ${toggle('requireSimplified', 'Exigir simplificado', 'No Modo 2, 6/8 não conta se a resposta for 3/4')}
      <label class="toggle-row"><span><b>Modo escuro</b><small>Tema da aplicação</small></span>
        <input type="checkbox" data-theme-toggle ${st.theme === 'dark' ? 'checked' : ''}><span class="switch" aria-hidden="true"></span></label>
    </section>
    <section class="panel">
      <h3>Tempo por pergunta (escolha múltipla)</h3>
      <div class="chips">${[10, 15, 20, 30].map((v) => `<button class="chip ${v === st.perQuestion ? 'on' : ''}" data-pq="${v}">${v} s</button>`).join('')}</div>
      <h3>Tempo por conta (resposta escrita)</h3>
      <div class="chips">${WRITTEN_TIMES.map(([v, l]) => `<button class="chip ${v === st.writtenTime ? 'on' : ''}" data-wt="${v}">${l}</button>`).join('')}</div>
    </section>
    <section class="panel">
      <h3>Instalar no telemóvel</h3>
      <p class="muted small">No Android (Chrome): menu ⋮ → <b>Instalar aplicação</b>. No iPhone (Safari): botão Partilhar → <b>Adicionar ao ecrã principal</b>.</p>
      <button class="btn ghost block install-btn" hidden>📲 Instalar agora</button>
    </section>
    <section class="panel">
      <a class="btn ghost block" href="tests/index.html">🧪 Testes do motor matemático</a>
      <button class="btn danger block" data-act="reset">Apagar todos os dados</button>
    </section>
    <p class="muted small center">Contas Turbo · funciona sem internet depois de aberta uma vez</p>`);
  bindBack(root);
  root.querySelectorAll('[data-set]').forEach((i) => i.addEventListener('change', () => settings.set({ [i.dataset.set]: i.checked })));
  root.querySelector('[data-theme-toggle]').addEventListener('change', (e) => { settings.set({ theme: e.target.checked ? 'dark' : 'light' }); applyTheme(); });
  bindChips(root, 'pq', (v) => settings.set({ perQuestion: +v }));
  bindChips(root, 'wt', (v) => settings.set({ writtenTime: +v }));
  const ib = root.querySelector('.install-btn');
  if (deferredInstall) {
    ib.hidden = false;
    ib.onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; ib.hidden = true; };
  }
  root.querySelector('[data-act="reset"]').addEventListener('click', () => {
    const m = modal(`<h3>Apagar tudo?</h3><p class="muted">Recordes, estatísticas, conquistas e erros guardados. Não dá para desfazer.</p>
      <div class="row"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-act="yes">Apagar</button></div>`);
    m.el.querySelector('[data-act="yes"]').onclick = () => { resetAll(); m.close(); applyTheme(); toast('Dados apagados.'); ROUTES.settings(); };
  });
};

// =====================================================================
// DUELO (ver ui/duel.js)
// =====================================================================
ROUTES.duel = () => duelSetup({ onAchievement: () => checkAchievements({ event: 'duel', stats: stats.get() }).forEach(achievementToast), back: () => history.back() });

// =====================================================================
// ARRANQUE
// =====================================================================
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

applyTheme();
history.replaceState({ name: 'home' }, '', '#home');
ROUTES.home();
