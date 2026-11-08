// Árvore de expressões: construção, avaliação exata, serialização e formatação.
//
// Nós:
//   { t:'num',  v:Q, raw?:[n,d], keep?:bool }   número (raw = forma por simplificar, para mostrar)
//   { t:'neg',  a }                              menos unário: -3² = neg(pow(3,2))
//   { t:'bin',  op:'+'|'-'|'*'|'/', a, b }       operação binária (÷ em linha)
//   { t:'pow',  a, e:number }                    potência de expoente inteiro ≥ 0
//   { t:'frac', a, b }                           traço de fração com expressões em cima/em baixo
//
// A prioridade das operações está codificada na própria árvore; os parênteses são
// acrescentados automaticamente na formatação sempre que são necessários.

import { Q } from './rational.js';

// ---------- construção ----------
export const num = (n, d = 1) => ({ t: 'num', v: new Q(n, d) });
export const numQ = (v) => ({ t: 'num', v });
export const neg = (a) => ({ t: 'neg', a });
export const add = (a, b) => ({ t: 'bin', op: '+', a, b });
export const sub = (a, b) => ({ t: 'bin', op: '-', a, b });
export const mul = (a, b) => ({ t: 'bin', op: '*', a, b });
export const dvd = (a, b) => ({ t: 'bin', op: '/', a, b });
export const pow = (a, e) => ({ t: 'pow', a, e });
export const frac = (a, b) => ({ t: 'frac', a, b });
export const bin = (op, a, b) => ({ t: 'bin', op, a, b });

// ---------- avaliação ----------
const OPS = {
  '+': (a, b) => a.add(b),
  '-': (a, b) => a.sub(b),
  '*': (a, b) => a.mul(b),
  '/': (a, b) => a.div(b),
};

/** Regras de avaliação corretas. Os "erros típicos" (distratores) substituem algumas destas. */
export const STD = {
  num: (n) => n.v,
  neg: (n, ev) => ev(n.a).neg(),
  bin: (n, ev) => OPS[n.op](ev(n.a), ev(n.b)),
  pow: (n, ev) => ev(n.a).pow(n.e),
  frac: (n, ev) => ev(n.a).div(ev(n.b)),
};

export function evaluate(node, rules = STD) {
  const ev = (x) => (rules[x.t] || STD[x.t])(x, ev, STD);
  return ev(node);
}

/** Visita todos os nós (pré-ordem). fn(node, parent) */
export function walk(node, fn, parent = null) {
  fn(node, parent);
  if (node.a) walk(node.a, fn, node);
  if (node.b) walk(node.b, fn, node);
}

export function some(node, pred) {
  let found = false;
  walk(node, (n, p) => { if (!found && pred(n, p)) found = true; });
  return found;
}

export function countOps(node) {
  let c = 0;
  walk(node, (n) => { if (n.t !== 'num') c++; });
  return c;
}

// ---------- serialização (BigInt não vai para JSON diretamente) ----------
export function toJSON(node) {
  switch (node.t) {
    case 'num': return { t: 'num', v: node.v.toString() };
    case 'neg': return { t: 'neg', a: toJSON(node.a) };
    case 'pow': return { t: 'pow', a: toJSON(node.a), e: node.e };
    default: return { ...node, a: toJSON(node.a), b: toJSON(node.b) };
  }
}

export function fromJSON(o) {
  switch (o.t) {
    case 'num': return numQ(Q.parse(o.v));
    case 'neg': return neg(fromJSON(o.a));
    case 'pow': return pow(fromJSON(o.a), o.e);
    default: return { ...o, a: fromJSON(o.a), b: fromJSON(o.b) };
  }
}

// ---------- prioridade e parênteses ----------
function numParts(n) {
  if (n.raw) return { n: n.raw[0], d: n.raw[1] };
  return { n: n.v.n, d: n.v.d };
}

function isNegNum(n) {
  if (n.t !== 'num') return false;
  const { n: a, d } = numParts(n);
  return n.raw ? a < 0n && d > 0n : a < 0n;
}

/** Nível de prioridade de um nó, para decidir parênteses. */
export function prec(n) {
  switch (n.t) {
    case 'num': return isNegNum(n) ? 3 : 5;
    case 'neg': return 3;
    case 'bin': return n.op === '+' || n.op === '-' ? 1 : 2;
    case 'pow': return 4;
    case 'frac': return 5;
  }
}

/** O filho precisa de parênteses dentro do pai? side = 'a' | 'b' */
export function needsParens(parent, child, side) {
  if (!parent) return false;
  const p = prec(child);
  switch (parent.t) {
    case 'frac': return false; // o traço já agrupa
    case 'pow': // base: só inteiros positivos dispensam parênteses
      return !(child.t === 'num' && !isNegNum(child) && numParts(child).d === 1n && !child.raw);
    case 'neg': return p <= 3;
    case 'bin': {
      const additive = parent.op === '+' || parent.op === '-';
      if (p === 3) return side === 'b' || !additive; // negativos: (-9), mas -5 - (-3) no início
      if (additive) return side === 'b' ? p <= 1 : false;
      return side === 'b' ? p <= 2 : p <= 1;
    }
  }
  return false;
}

// ---------- formatação HTML ----------
const MINUS = '−';
const esc = (s) => String(s).replace(/-/g, MINUS);

function hasFraction(n) {
  return some(n, (x) => x.t === 'frac' || (x.t === 'num' && numParts(x).d !== 1n));
}

function fracHTML(top, bottom) {
  return `<span class="fr"><span class="fn">${top}</span><span class="fd">${bottom}</span></span>`;
}

function numHTML(n) {
  const { n: a, d } = numParts(n);
  if (d === 1n) return `<span class="nm">${esc(a)}</span>`;
  if (n.raw && (d < 0n)) return fracHTML(esc(a), esc(d)); // ex.: -4 sobre -2 antes de simplificar
  const sign = a < 0n ? `<span class="nm">${MINUS}</span>` : '';
  const absA = a < 0n ? -a : a;
  return `${sign}${fracHTML(absA, d)}`;
}

const OP_HTML = { '+': '+', '-': MINUS, '*': '×', '/': '÷' };

export function toHTML(node, parent = null, side = null) {
  let inner;
  switch (node.t) {
    case 'num': inner = numHTML(node); break;
    case 'neg': inner = `<span class="nm">${MINUS}</span>${toHTML(node.a, node, 'a')}`; break;
    case 'bin':
      inner = `${toHTML(node.a, node, 'a')} <span class="op">${OP_HTML[node.op]}</span> ${toHTML(node.b, node, 'b')}`;
      break;
    case 'pow': inner = `${toHTML(node.a, node, 'a')}<sup>${node.e}</sup>`; break;
    case 'frac': inner = fracHTML(toHTML(node.a, node, 'a'), toHTML(node.b, node, 'b')); break;
  }
  if (needsParens(parent, node, side)) {
    const tall = hasFraction(node) ? ' tall' : '';
    return `<span class="grp${tall}"><span class="pa">(</span>${inner}<span class="pa">)</span></span>`;
  }
  return inner;
}

/** Formatação em texto simples (partilhar, acessibilidade, chave anti-repetição). */
export function toText(node, parent = null, side = null) {
  let s;
  const OPT = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ' };
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  switch (node.t) {
    case 'num': { const { n, d } = numParts(node); s = esc(d === 1n ? `${n}` : `${n}/${d}`); break; }
    case 'neg': s = MINUS + toText(node.a, node, 'a'); break;
    case 'bin': s = toText(node.a, node, 'a') + OPT[node.op] + toText(node.b, node, 'b'); break;
    case 'pow': s = toText(node.a, node, 'a') + String(node.e).split('').map((c) => SUP[c]).join(''); break;
    case 'frac': {
      const wrap = (x) => (x.t === 'num' ? toText(x) : `(${toText(x)})`);
      s = `${wrap(node.a)}/${wrap(node.b)}`;
      break;
    }
  }
  return needsParens(parent, node, side) ? `(${s})` : s;
}

/** Formata um valor Q (resposta) em HTML. */
export function qHTML(q) { return toHTML(numQ(q)); }
