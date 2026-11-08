// Distratores: opções erradas que vêm de ERROS TÍPICOS.
// Cada erro é um conjunto de regras de avaliação "com defeito" que substitui as regras certas
// (ver STD em expr.js). Avalia-se a conta com cada erro; o que der diferente da resposta certa
// é um distrator realista, com a explicação do erro.

import { Q } from './rational.js';
import * as E from './expr.js';

const isNegative = (q) => q.isNeg();

/** Reescreve a árvore "da esquerda para a direita", ignorando a prioridade das operações. */
function leftToRight(node) {
  if (node.t === 'num') return node;
  let n = { ...node };
  if (n.a) n.a = leftToRight(n.a);
  if (n.b) n.b = leftToRight(n.b);
  if (n.t === 'bin') {
    const c = n.b;
    if (c.t === 'bin' && E.prec(c) > E.prec(n) && !E.needsParens(n, c, 'b')) {
      // a + b × c  →  (a + b) × c
      return leftToRight(E.bin(c.op, E.bin(n.op, n.a, c.a), c.b));
    }
    if (c.t === 'pow' && !E.needsParens(n, c, 'b')) {
      // a × b²  →  (a × b)²
      return leftToRight(E.pow(E.bin(n.op, n.a, c.a), c.e));
    }
  }
  return n;
}

export const BUGS = [
  {
    id: 'menosQuadrado',
    why: '−3² = −9: a potência só se aplica ao 3, o sinal fica de fora. Só (−3)² = 9.',
    rules: { neg: (n, ev, S) => (n.a.t === 'pow' ? ev(n.a.a).neg().pow(n.a.e) : S.neg(n, ev)) },
  },
  {
    id: 'basePorExpoente',
    why: 'Uma potência não é base × expoente: 2³ = 2 × 2 × 2 = 8 (e não 6).',
    rules: { pow: (n, ev) => ev(n.a).mul(new Q(n.e)) },
  },
  {
    id: 'baseNegativaPar',
    why: 'Base negativa com expoente PAR dá positivo: (−3)² = (−3) × (−3) = 9.',
    rules: {
      pow: (n, ev, S) => {
        const b = ev(n.a);
        return isNegative(b) && n.e % 2 === 0 ? b.abs().pow(n.e).neg() : S.pow(n, ev);
      },
    },
  },
  {
    id: 'expoenteZero',
    why: 'Qualquer número (diferente de 0) elevado a 0 dá 1, e elevado a 1 dá ele próprio.',
    rules: {
      pow: (n, ev, S) => (n.e === 0 ? Q.ZERO : n.e === 1 ? Q.ONE : S.pow(n, ev)),
    },
  },
  {
    id: 'somarTudo',
    why: 'Nas frações não se somam os denominadores: primeiro reduz-se ao mesmo denominador (3/4 + 1/2 = 3/4 + 2/4).',
    rules: {
      bin: (n, ev, S) => {
        if (n.op !== '+' && n.op !== '-') return S.bin(n, ev);
        const a = ev(n.a), b = ev(n.b);
        if (a.isInt() && b.isInt()) return S.bin(n, ev);
        const top = n.op === '+' ? a.n + b.n : a.n - b.n;
        const bot = n.op === '+' ? a.d + b.d : a.d - b.d;
        if (a.isInt() || b.isInt()) return new Q(top, a.isInt() ? b.d : a.d); // 2 + 1/2 = 3/2
        return new Q(top, bot);
      },
    },
  },
  {
    id: 'dividirSemInverter',
    why: 'Dividir por uma fração é multiplicar pelo INVERSO: 4/5 ÷ 2/3 = 4/5 × 3/2.',
    rules: {
      bin: (n, ev, S) => {
        if (n.op !== '/') return S.bin(n, ev);
        const a = ev(n.a), b = ev(n.b);
        if (a.isInt() && b.isInt()) return S.bin(n, ev);
        return a.mul(b);
      },
    },
  },
  {
    id: 'denominadorComum',
    why: 'Na multiplicação de frações também se multiplicam os denominadores.',
    rules: {
      bin: (n, ev, S) => {
        if (n.op !== '*') return S.bin(n, ev);
        const a = ev(n.a), b = ev(n.b);
        if (a.isInt() && b.isInt()) return S.bin(n, ev);
        if (a.d === b.d) return new Q(a.n * b.n, a.d);
        return new Q(a.n * b.n, a.d + b.d);
      },
    },
  },
  {
    id: 'menosMenos',
    why: 'Menos com menos dá mais: 5 − (−3) = 5 + 3.',
    rules: {
      bin: (n, ev, S) => {
        if (n.op !== '-') return S.bin(n, ev);
        const a = ev(n.a), b = ev(n.b);
        return isNegative(b) ? a.add(b) : a.sub(b);
      },
    },
  },
  {
    id: 'sinaisProduto',
    why: 'Regra dos sinais: negativo × negativo = positivo; negativo × positivo = negativo.',
    rules: {
      bin: (n, ev, S) => {
        if (n.op !== '*' && n.op !== '/') return S.bin(n, ev);
        const r = S.bin(n, ev);
        const a = ev(n.a), b = ev(n.b);
        if (isNegative(a) && isNegative(b)) return r.neg();
        if (isNegative(a) !== isNegative(b)) return r.abs();
        return r;
      },
    },
  },
  {
    id: 'numeradorTodo',
    why: 'O traço de fração funciona como parênteses: divide-se o numerador TODO pelo denominador.',
    rules: {
      frac: (n, ev, S) => {
        if (n.a.t === 'bin' && (n.a.op === '+' || n.a.op === '-')) {
          const left = ev(n.a.a), right = ev(n.a.b).div(ev(n.b));
          return n.a.op === '+' ? left.add(right) : left.sub(right);
        }
        return S.frac(n, ev);
      },
    },
  },
  {
    id: 'prioridade',
    why: 'Prioridade: parênteses → potências → × e ÷ → + e −. Não se faz tudo da esquerda para a direita.',
    transform: leftToRight,
  },
  {
    id: 'sinal',
    why: 'Atenção ao sinal do resultado.',
    post: (v) => v.neg(),
  },
];

function bugValue(bug, tree) {
  const t = bug.transform ? bug.transform(tree) : tree;
  let v = E.evaluate(t, bug.rules ? { ...E.STD, ...bug.rules } : E.STD);
  if (bug.post) v = bug.post(v);
  return v;
}

/** Todos os erros típicos que dão um resultado diferente do certo: [{ value:Q, id, why }] */
export function typicalErrors(tree, answer) {
  const out = [];
  const seen = new Set([answer.toString()]);
  for (const bug of BUGS) {
    let v;
    try { v = bugValue(bug, tree); } catch { continue; }
    if (v.d > 1000n || v.size() > 100000n) continue;
    const k = v.toString();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ value: v, id: bug.id, why: bug.why });
  }
  return out;
}

/** Explica, se possível, qual erro típico levou a um valor errado. */
export function explainWrong(tree, answer, wrong) {
  const e = typicalErrors(tree, answer).find((x) => x.value.eq(wrong));
  return e ? e.why : null;
}

/**
 * 3 distratores. Prefere erros típicos (o "sinal" fica para o fim); se faltarem,
 * usa quase-certos (±1, inverso, numerador trocado...).
 */
export function makeDistractors(tree, answer, rng, count = 3) {
  const errs = typicalErrors(tree, answer);
  const main = rng.shuffle(errs.filter((e) => e.id !== 'sinal'));
  const sign = errs.filter((e) => e.id === 'sinal');
  const chosen = [...main.slice(0, count)];
  if (chosen.length < count) chosen.push(...sign);
  const keys = new Set([answer.toString(), ...chosen.map((c) => c.value.toString())]);

  const fillers = [];
  const a = answer;
  const one = Q.ONE;
  if (!a.isInt()) {
    fillers.push(new Q(a.d, a.n === 0n ? 1n : a.n));
    fillers.push(new Q(a.n + 1n, a.d), new Q(a.n, a.d + 1n), a.neg());
  }
  fillers.push(a.add(one), a.sub(one), a.add(new Q(2)), a.sub(new Q(10)), a.mul(new Q(2)), a.add(new Q(10)), a.neg());
  for (const f of rng.shuffle(fillers)) {
    if (chosen.length >= count) break;
    const k = f.toString();
    if (keys.has(k)) continue;
    keys.add(k);
    chosen.push({ value: f, id: 'perto', why: null });
  }
  return chosen.slice(0, count);
}

/** 4 opções baralhadas: [{ value, correct, why }] */
export function makeOptions(q, rng) {
  const ds = makeDistractors(q.tree, q.answer, rng);
  return rng.shuffle([{ value: q.answer, correct: true, why: null }, ...ds.map((d) => ({ ...d, correct: false }))]);
}
