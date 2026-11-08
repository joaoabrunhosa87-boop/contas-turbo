// Lógica de jogo (sem DOM): perguntas, pontos, combos, vidas e tempo.

import { QuestionGen } from '../math/generators.js';
import { makeOptions } from '../math/distractors.js';
import { RNG } from '../math/rng.js';
import * as E from '../math/expr.js';

// ---------- balanceamento ----------
export const BASE_POINTS = [100, 150, 200, 300];      // por nível de dificuldade
export const LIVES = 3;
export const BLITZ_SECONDS = 60;                      // contra-relógio
export const BLITZ_BONUS_WINDOW = 8;                  // s para ganhar bónus de rapidez no contra-relógio
export const DAILY_COUNT = 10;
export const DAILY_LEVEL = 1;
export const DAILY_SECONDS = 20;

export function comboMult(combo) {
  if (combo >= 12) return 3;
  if (combo >= 8) return 2.5;
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

export const hasNegatives = (tree) =>
  E.some(tree, (n) => (n.t === 'num' && n.v.isNeg()) || n.t === 'neg');

/**
 * cfg: {
 *   mode: 'escolha' | 'escrita' | 'treino' | 'diario' | 'revisao',
 *   sub: 'pergunta' | 'relogio' (Modo 1),
 *   lvl, types:[ids], answer:'escolha'|'escrita',
 *   lives (Infinity = sem vidas), perQ (s ou null), total (s ou null), count (nº de perguntas ou null),
 *   preset: [perguntas prontas] (diário / revisão), rng
 * }
 */
export class Session {
  constructor(cfg) {
    this.cfg = { lives: LIVES, perQ: null, total: null, count: null, answer: 'escolha', ...cfg };
    this.rng = cfg.rng || new RNG();
    this.gen = new QuestionGen(this.rng);
    this.score = 0;
    this.lives = this.cfg.lives;
    this.combo = 0;
    this.bestCombo = 0;
    this.correct = 0;
    this.wrong = 0;
    this.index = 0;
    this.history = [];
    this.timeLeftTotal = this.cfg.total;
    this.lostLife = false;
    this.over = false;
    this.q = null;
  }

  get key() { // chave dos recordes
    const { mode, sub } = this.cfg;
    return mode === 'escolha' ? `escolha-${sub}` : mode;
  }

  nextQuestion() {
    let q;
    if (this.cfg.preset) {
      if (this.index >= this.cfg.preset.length) { this.over = true; return null; }
      q = this.cfg.preset[this.index];
    } else {
      q = this.gen.makeMixed(this.cfg.types, this.cfg.lvl);
    }
    if (this.cfg.answer === 'escolha' && !q.options) q.options = makeOptions(q, this.rng);
    this.q = q;
    this.timeLeftQ = this.cfg.perQ;
    this.elapsed = 0;
    this.index++;
    return q;
  }

  /** Avança o relógio dt segundos. Devolve 'total' | 'pergunta' | null quando o tempo acaba. */
  tick(dt) {
    this.elapsed += dt;
    if (this.timeLeftTotal != null) {
      this.timeLeftTotal = Math.max(0, this.timeLeftTotal - dt);
      if (this.timeLeftTotal === 0) { this.over = true; return 'total'; }
    }
    if (this.timeLeftQ != null) {
      this.timeLeftQ = Math.max(0, this.timeLeftQ - dt);
      if (this.timeLeftQ === 0) return 'pergunta';
    }
    return null;
  }

  speedBonus(base) {
    if (this.cfg.perQ) return Math.round(base * (this.timeLeftQ / this.cfg.perQ));
    if (this.cfg.total) return Math.round(base * Math.max(0, 1 - this.elapsed / BLITZ_BONUS_WINDOW));
    return 0;
  }

  /** Regista a resposta. Devolve { points, base, bonus, mult, ms, over } */
  submit(isCorrect, extra = {}) {
    const ms = Math.round(this.elapsed * 1000);
    let points = 0, bonus = 0, mult = 1;
    const base = BASE_POINTS[this.q.lvl ?? this.cfg.lvl];
    if (isCorrect) {
      this.combo++;
      this.correct++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      bonus = this.speedBonus(base);
      mult = comboMult(this.combo);
      points = Math.round((base + bonus) * mult);
      this.score += points;
    } else {
      this.combo = 0;
      this.wrong++;
      if (Number.isFinite(this.lives)) {
        this.lives--;
        this.lostLife = true;
        if (this.lives <= 0) this.over = true;
      }
    }
    if (this.cfg.count && this.index >= this.cfg.count) this.over = true;
    if (this.cfg.preset && this.index >= this.cfg.preset.length) this.over = true;
    this.history.push({ q: this.q, correct: isCorrect, ms, points, ...extra });
    return { points, base, bonus, mult, ms, over: this.over };
  }

  avgMs() {
    if (!this.history.length) return 0;
    return Math.round(this.history.reduce((s, h) => s + h.ms, 0) / this.history.length);
  }
}

/** As mesmas 10 contas para toda a gente nesse dia (semente = data). */
export function dailyQuestions(dateStr) {
  const rng = new RNG('contas-turbo-diario:' + dateStr);
  const gen = new QuestionGen(rng);
  const order = ['neg', 'pot', 'frac', 'fexp', 'expr', 'neg', 'pot', 'frac', 'fexp', 'expr'];
  return order.map((type) => {
    const q = gen.make(type, DAILY_LEVEL);
    q.options = makeOptions(q, rng);
    return q;
  });
}

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
