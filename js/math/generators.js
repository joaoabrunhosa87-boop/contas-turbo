// Geradores procedurais de contas. Cada gerador cria uma árvore aleatória; depois a conta é
// validada (resultado "limpo", sem divisões por zero, números intermédios controlados) e
// rejeitada se já tiver saído nesta sessão.

import { Q, gcd } from './rational.js';
import * as E from './expr.js';
import { RNG } from './rng.js';

export const TYPES = [
  { id: 'neg', name: 'Números negativos', icon: '±' },
  { id: 'pot', name: 'Potências', icon: 'x²' },
  { id: 'frac', name: 'Frações', icon: '½' },
  { id: 'fexp', name: 'Frações com expressões', icon: '⅟' },
  { id: 'expr', name: 'Expressões grandes', icon: '( )' },
];
export const TYPE_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const LEVELS = ['Fácil', 'Médio', 'Difícil', 'Insano'];

// ---------- folhas ----------
const int = (r, max, negP = 0) => E.num(r.chance(negP) ? -r.int(1, max) : r.int(1, max));

function fracLeaf(r, maxDen, { negP = 0, intP = 0, intMax = 6, proper = false } = {}) {
  if (r.chance(intP)) return int(r, intMax, negP);
  const d = r.int(2, maxDen);
  let n;
  do { n = r.int(1, proper ? d - 1 : Math.max(d + 3, 2 * d)); } while (gcd(BigInt(n), BigInt(d)) !== 1n);
  return E.num(r.chance(negP) ? -n : n, d);
}

// ---------- árvore aleatória ----------
/**
 * cfg: { ops:[[op,peso]], leaf(), powLeaf(), powP, exps, negPowP, divMax, negP, fracOK }
 * n = número de operações binárias/potências a usar.
 */
export function randTree(r, n, cfg) {
  if (n <= 0) return cfg.leaf();
  if (cfg.powP && n <= 2 && r.chance(cfg.powP)) {
    const base = n === 1
      ? (cfg.powLeaf || cfg.leaf)()
      : randTree(r, 1, { ...cfg, powP: 0, ops: [['+', 1], ['-', 1]] });
    const p = E.pow(base, r.pick(cfg.exps || [2]));
    if (n === 1 && cfg.negPowP && base.t === 'num' && !base.v.isNeg() && r.chance(cfg.negPowP)) return E.neg(p);
    return p;
  }
  const op = r.weighted(cfg.ops);
  const k = r.int(0, n - 1);
  const right = n - 1 - k;
  const a = randTree(r, k, cfg);
  if (op === '/' && !cfg.fracOK) {
    // divisão exata: escolher um divisor do valor da esquerda
    let v = null;
    try { v = E.evaluate(a); } catch { /* ignora */ }
    if (right === 0 && v && v.isInt() && !v.isZero()) {
      const m = v.n < 0n ? -v.n : v.n;
      const divs = [];
      for (let d = 2; d <= (cfg.divMax || 10) && BigInt(d) <= m; d++) if (m % BigInt(d) === 0n) divs.push(d);
      if (divs.length) {
        const d = r.pick(divs);
        return E.dvd(a, E.num(r.chance(cfg.negP || 0) ? -d : d));
      }
    }
    return E.mul(a, randTree(r, right, cfg));
  }
  return E.bin(op, a, randTree(r, right, cfg));
}

// ---------- validação ----------
function parenCount(tree) {
  let c = 0;
  E.walk(tree, (n, p) => { if (p && E.needsParens(p, n, p.a === n ? 'a' : 'b')) c++; });
  return c;
}

const big = BigInt;

function check(tree, L) {
  let ok = true;
  E.walk(tree, (n) => {
    if (!ok || n.t === 'num') return;
    let v;
    try { v = E.evaluate(n); } catch { ok = false; return; }
    if (v.size() > big(L.inter) || v.d > big(L.den)) ok = false;
    if (L.intDiv && (n.t === 'frac' || (n.t === 'bin' && n.op === '/')) && !v.isInt()) ok = false;
    if (n.t === 'pow') {
      const b = E.evaluate(n.a);
      if (b.isZero()) ok = false;
    }
  });
  if (!ok) return false;
  const v = E.evaluate(tree);
  if (v.d > big(L.resDen) || v.size() > big(L.res)) return false;
  if (L.minParens && parenCount(tree) < L.minParens) return false;
  if (L.needNeg && !E.some(tree, (n) => (n.t === 'num' && n.v.isNeg()) || n.t === 'neg')) return false;
  if (L.check && !L.check(tree, v)) return false;
  return true;
}

const lim = (inter, den, res, resDen, extra = {}) => ({ inter, den, res, resDen, ...extra });

// ---------- geradores por tipo ----------
const GEN = {
  neg: {
    limits: [
      lim(100, 1, 100, 1, { intDiv: true, needNeg: true }),
      lim(400, 1, 400, 1, { intDiv: true, needNeg: true }),
      lim(1000, 1, 1000, 1, { intDiv: true, needNeg: true }),
      lim(3000, 1, 3000, 1, { intDiv: true, needNeg: true, minParens: 3 }),
    ],
    make(r, lvl) {
      const max = [10, 20, 15, 25][lvl];
      const ops = lvl === 0 ? [['+', 3], ['-', 3], ['*', 2]] : [['+', 3], ['-', 3], ['*', 2], ['/', 2]];
      const n = [1, 1, 2, 3 + r.int(0, 1)][lvl];
      return randTree(r, n, { ops, leaf: () => int(r, max, 0.6), divMax: max, negP: 0.5 });
    },
  },

  pot: {
    limits: [
      lim(1100, 1, 1100, 1),
      lim(2000, 1, 2000, 1),
      lim(5000, 100, 5000, 100),
      lim(20000, 1000, 20000, 1000),
    ],
    make(r, lvl) {
      const n = (a, d = 1) => E.num(a, d);
      const coprimeFrac = (maxN, maxD, negP) => {
        let a, d;
        do { a = r.int(1, maxN); d = r.int(2, maxD); } while (gcd(big(a), big(d)) !== 1n);
        return n(r.chance(negP) ? -a : a, d);
      };
      const F = [
        [ // Fácil
          () => E.pow(n(r.int(2, 10)), 2),
          () => E.pow(n(r.int(2, 5)), 3),
          () => E.pow(n(r.int(2, 20)), r.pick([0, 1])),
          () => E.pow(n(-r.int(2, 6)), 2),
          () => E.pow(n(2), r.int(2, 6)),
        ],
        [ // Médio
          () => E.pow(n(-r.int(2, 5)), r.pick([2, 3])),
          () => E.neg(E.pow(n(r.int(2, 9)), 2)),
          () => E.pow(E.sub(n(r.int(4, 12)), n(r.int(1, 8))), r.pick([2, 3])),
          () => E.pow(n(-r.int(2, 30)), r.pick([0, 1])),
          () => E.neg(E.pow(n(r.int(2, 4)), 3)),
          () => E.neg(E.pow(n(r.int(2, 30)), 0)),
        ],
        [ // Difícil
          () => E.add(E.neg(E.pow(n(r.int(2, 6)), 2)), E.pow(n(-r.int(2, 6)), 2)),
          () => E.sub(E.pow(n(-r.int(2, 4)), 3), E.pow(n(r.int(2, 6)), 2)),
          () => E.mul(E.pow(E.sub(n(r.int(1, 6)), n(r.int(3, 10))), 2), n(r.nz(-5, 5))),
          () => E.pow(coprimeFrac(4, 5, 0.4), r.pick([2, 3])),
          () => E.add(E.pow(n(r.nz(-9, 9)), 0), E.mul(n(r.int(2, 5)), E.pow(n(-r.int(1, 3)), r.pick([2, 3])))),
          () => E.sub(E.neg(E.pow(n(r.int(2, 5)), 2)), E.pow(E.sub(n(r.int(1, 4)), n(r.int(5, 8))), 2)),
        ],
        [ // Insano
          () => E.pow(n(-2), r.int(4, 8)),
          () => E.mul(E.pow(coprimeFrac(4, 5, 0.5), r.pick([2, 3])), E.pow(n(r.nz(-3, 3)), 2)),
          () => E.neg(E.pow(E.sub(n(r.int(1, 5)), n(r.int(6, 10))), r.pick([2, 3]))),
          () => E.pow(E.sub(E.pow(n(r.int(2, 5)), 2), n(r.int(1, 30))), 2),
          () => E.mul(E.neg(E.pow(n(r.int(2, 4)), 2)), E.pow(n(-r.int(2, 3)), 3)),
          () => E.sub(E.pow(n(-3), r.int(3, 5)), E.neg(E.pow(n(r.int(2, 3)), r.int(3, 4)))),
        ],
      ];
      // às vezes reaproveita formas do nível anterior
      const lvlUse = lvl > 0 && r.chance(0.25) ? lvl - 1 : lvl;
      return r.pick(F[lvlUse])();
    },
  },

  frac: {
    limits: [
      lim(60, 12, 30, 12, { check: (t, v) => !v.isZero() && E.some(t, (x) => x.t === 'num' && !x.v.isInt()) }),
      lim(150, 30, 60, 30),
      lim(300, 60, 100, 60),
      lim(800, 120, 200, 120, { minParens: 1 }),
    ],
    make(r, lvl) {
      const cfgs = [
        { n: 1, ops: [['+', 4], ['-', 3], ['*', 2]], leaf: () => fracLeaf(r, 6, { proper: true }) },
        { n: 1, ops: [['+', 3], ['-', 3], ['*', 2], ['/', 2]], leaf: () => fracLeaf(r, 10, { intP: 0.1 }) },
        { n: 2, ops: [['+', 3], ['-', 3], ['*', 2], ['/', 2]], leaf: () => fracLeaf(r, 9, { negP: 0.3, intP: 0.15 }) },
        { n: 3, ops: [['+', 3], ['-', 3], ['*', 2], ['/', 2]], leaf: () => fracLeaf(r, 12, { negP: 0.4, intP: 0.2 }) },
      ];
      const c = cfgs[lvl];
      return randTree(r, c.n, { ...c, fracOK: true });
    },
  },

  fexp: {
    limits: [
      lim(100, 1, 30, 1, { intDiv: true }),
      lim(300, 9, 60, 9),
      lim(600, 12, 100, 12),
      lim(1500, 20, 200, 20, { minParens: 1 }),
    ],
    make(r, lvl) {
      const divisorOf = (tree, maxD) => {
        let v; try { v = E.evaluate(tree); } catch { return null; }
        if (!v.isInt() || v.isZero()) return null;
        const m = v.n < 0n ? -v.n : v.n;
        const ds = [];
        for (let d = 2; d <= maxD; d++) if (m % big(d) === 0n) ds.push(d);
        return ds.length ? r.pick(ds) : null;
      };
      if (lvl === 0) {
        const top = randTree(r, 1, { ops: [['+', 3], ['-', 1]], leaf: () => int(r, 20) });
        const d = divisorOf(top, 9);
        return d ? E.frac(top, E.num(d)) : null;
      }
      if (lvl === 1) {
        const top = randTree(r, r.int(1, 2), {
          ops: [['+', 3], ['-', 3], ['*', 1]], leaf: () => int(r, 12, 0.25),
          powP: 0.4, exps: [2], powLeaf: () => int(r, 5),
        });
        const d = r.chance(0.7) ? divisorOf(top, 9) : r.int(2, 9);
        return d ? E.frac(top, E.num(r.chance(0.2) ? -d : d)) : null;
      }
      const cfg = {
        ops: [['+', 3], ['-', 3], ['*', 2]], leaf: () => int(r, 10, 0.35),
        powP: 0.3, exps: [2, 3], powLeaf: () => int(r, 4), negPowP: 0.3,
      };
      if (lvl === 2) return E.frac(randTree(r, 2, cfg), randTree(r, 1, { ...cfg, powP: 0 }));
      const f = E.frac(randTree(r, r.int(2, 3), cfg), randTree(r, 1, { ...cfg, powP: 0 }));
      const other = r.chance(0.5)
        ? E.frac(randTree(r, 1, { ...cfg, powP: 0 }), int(r, 6))
        : randTree(r, 1, { ...cfg, powP: 0.5 });
      return r.chance(0.5) ? E.bin(r.pick(['+', '-']), f, other) : E.bin(r.pick(['-', '*']), other, f);
    },
  },

  expr: {
    limits: [
      lim(400, 1, 400, 1, { intDiv: true, minParens: 1 }),
      lim(600, 1, 600, 1, { intDiv: true, minParens: 1 }),
      lim(2000, 12, 1000, 12, { minParens: 2 }),
      lim(5000, 30, 3000, 30, { minParens: 3 }),
    ],
    make(r, lvl) {
      const c = [
        { n: 3, ops: [['+', 3], ['-', 3], ['*', 3], ['/', 1]], leaf: () => int(r, 10), powP: 0.3, exps: [2], powLeaf: () => int(r, 9) },
        { n: 4, ops: [['+', 3], ['-', 3], ['*', 3], ['/', 2]], leaf: () => int(r, 12, 0.25), powP: 0.3, exps: [2, 3], powLeaf: () => int(r, 5), negPowP: 0.3, negP: 0.3, divMax: 12 },
        { n: 5, ops: [['+', 3], ['-', 3], ['*', 3], ['/', 2]], leaf: () => fracLeaf(r, 6, { intP: 0.85, intMax: 12, negP: 0.3 }), powP: 0.3, exps: [2, 3], powLeaf: () => int(r, 5, 0.3), negPowP: 0.3, fracOK: true },
        { n: 6 + r.int(0, 1), ops: [['+', 3], ['-', 3], ['*', 3], ['/', 2]], leaf: () => fracLeaf(r, 6, { intP: 0.8, intMax: 12, negP: 0.35 }), powP: 0.35, exps: [2, 3], powLeaf: () => fracLeaf(r, 4, { intP: 0.75, intMax: 5, negP: 0.4 }), negPowP: 0.3, fracOK: true },
      ][lvl];
      return randTree(r, c.n, c);
    },
  },
};

export class QuestionGen {
  constructor(rng = new RNG()) {
    this.r = rng;
    this.seen = new Set();
  }

  /** Gera uma pergunta { type, lvl, tree, answer:Q, text, html } que ainda não saiu. */
  make(type, lvl) {
    const g = GEN[type];
    const L = g.limits[lvl];
    for (let i = 0; i < 3000; i++) {
      const tree = g.make(this.r, lvl);
      if (!tree || !check(tree, L)) continue;
      const text = E.toText(tree);
      if (this.seen.has(text)) continue;
      this.seen.add(text);
      return { type, lvl, tree, answer: E.evaluate(tree), text, html: E.toHTML(tree) };
    }
    throw new Error(`Não consegui gerar uma conta nova (${type}, nível ${lvl})`);
  }

  /** Tipo aleatório (com pesos) de entre os permitidos. */
  makeMixed(types, lvl) {
    return this.make(this.r.pick(types), lvl);
  }
}

export function questionFromTree(tree, type, lvl) {
  return { type, lvl, tree, answer: E.evaluate(tree), text: E.toText(tree), html: E.toHTML(tree) };
}
