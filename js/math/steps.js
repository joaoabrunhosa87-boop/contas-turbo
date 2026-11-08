// Resolução passo a passo, respeitando: parênteses → potências → × e ÷ → + e −.
// Em cada passo reduz-se o grupo de operações "prontas" (filhos já são números) com maior
// profundidade de parênteses e, a seguir, maior prioridade. Operações do mesmo grupo são
// feitas em simultâneo (ex.: 2×3 + 4×5 → 6 + 20).

import { Q, lcm } from './rational.js';
import { numQ, bin, toHTML, toText, needsParens } from './expr.js';

const CLASS = { pow: 4, neg: 3, '*': 2, '/': 2, frac: 2, '+': 1, '-': 1 };
const CLASS_LABEL = { 4: 'Potências', 3: 'Sinais', 2: 'Multiplicações e divisões', 1: 'Adições e subtrações' };

const isNum = (n) => n.t === 'num';
const pendingSimplify = (n) => isNum(n) && n.raw && !n.keep && !(n.raw[0] === n.v.n && n.raw[1] === n.v.d);

function rawNum(n, d) {
  const v = new Q(n, d);
  const node = numQ(v);
  if (!(n === v.n && d === v.d)) node.raw = [n, d];
  return node;
}

function nodeClass(n) {
  if (n.t === 'bin') return CLASS[n.op];
  return CLASS[n.t];
}

function isReady(n) {
  if (isNum(n)) return false;
  if (n.t === 'neg' || n.t === 'pow') return isNum(n.a);
  return isNum(n.a) && isNum(n.b);
}

function collect(node, depth, out, parent, side) {
  const d = depth + (needsParens(parent, node, side) || (parent && parent.t === 'frac') ? 1 : 0);
  if (isReady(node)) out.push({ node, depth: d, cls: nodeClass(node) });
  if (node.a) collect(node.a, d, out, node, 'a');
  if (node.b) collect(node.b, d, out, node, 'b');
}

function rebuild(node, map) {
  if (map.has(node)) return map.get(node);
  if (isNum(node)) return node;
  const c = { ...node };
  if (node.a) c.a = rebuild(node.a, map);
  if (node.b) c.b = rebuild(node.b, map);
  return c;
}

/** Reduz um nó pronto. Devolve { node, label? } */
function reduce(n) {
  const a = n.a.v, b = n.b ? n.b.v : null;
  switch (n.t) {
    case 'pow': return { node: numQ(a.pow(n.e)) };
    case 'neg': return { node: numQ(a.neg()) };
    case 'frac':
      if (a.isInt() && b.isInt()) return { node: rawNum(a.n, b.n), label: 'Fração' };
      return { node: bin('/', n.a, n.b), label: 'O traço de fração é uma divisão' };
    case 'bin':
      switch (n.op) {
        case '*':
          if (a.isInt() && b.isInt()) return { node: numQ(a.mul(b)) };
          return { node: rawNum(a.n * b.n, a.d * b.d), label: 'Frações: numerador × numerador, denominador × denominador' };
        case '/':
          if (b.isZero()) throw new Error('Divisão por zero');
          if (a.isInt() && b.isInt()) {
            const v = a.div(b);
            return { node: v.isInt() ? numQ(v) : rawNum(a.n, b.n) };
          }
          return { node: bin('*', n.a, numQ(b.inv())), label: 'Dividir é multiplicar pelo inverso' };
        case '+': case '-': {
          if (a.isInt() && b.isInt()) return { node: numQ(n.op === '+' ? a.add(b) : a.sub(b)) };
          const pa = n.a.keep ? n.a.raw : [a.n, a.d];
          const pb = n.b.keep ? n.b.raw : [b.n, b.d];
          if (pa[1] === pb[1]) {
            const top = n.op === '+' ? pa[0] + pb[0] : pa[0] - pb[0];
            return { node: rawNum(top, pa[1]), label: 'Mesmo denominador: juntar os numeradores' };
          }
          {
            const L = lcm(a.d, b.d);
            const ka = { ...numQ(a), raw: [a.n * (L / a.d), L], keep: true };
            const kb = { ...numQ(b), raw: [b.n * (L / b.d), L], keep: true };
            return { node: bin(n.op, ka, kb), label: 'Reduzir ao mesmo denominador' };
          }
        }
      }
  }
  throw new Error('Nó desconhecido');
}

/** Dá um passo. Devolve { tree, label } ou null se já é um número. */
export function step(tree) {
  // 1) Simplificações pendentes primeiro
  const simp = new Map();
  (function find(n) {
    if (pendingSimplify(n)) simp.set(n, numQ(n.v));
    if (n.a) find(n.a);
    if (n.b) find(n.b);
  })(tree);
  if (simp.size) return { tree: rebuild(tree, simp), label: 'Simplificar (dividir pelo m.d.c.)' };

  if (isNum(tree)) {
    if (tree.keep) return { tree: numQ(tree.v), label: 'Simplificar' };
    return null;
  }

  // 2) Grupo de operações prontas com mais parênteses e maior prioridade
  const ready = [];
  collect(tree, 0, ready, null, null);
  const maxDepth = Math.max(...ready.map((r) => r.depth));
  const atDepth = ready.filter((r) => r.depth === maxDepth);
  const maxCls = Math.max(...atDepth.map((r) => r.cls));
  const group = atDepth.filter((r) => r.cls === maxCls);

  const map = new Map();
  const labels = new Set();
  for (const r of group) {
    const res = reduce(r.node);
    map.set(r.node, res.node);
    if (res.label) labels.add(res.label);
  }
  let label = labels.size ? [...labels].join(' · ') : CLASS_LABEL[maxCls];
  if (maxDepth > 0 && !labels.size) label = `${label} (dentro dos parênteses)`;
  return { tree: rebuild(tree, map), label };
}

/**
 * Lista de passos: [{ html, text, label }]. O primeiro é a conta original.
 * Passos com aspeto igual ao anterior (ex.: −(9) → −9) são fundidos.
 */
export function solveSteps(tree, maxSteps = 60) {
  const out = [{ html: toHTML(tree), text: toText(tree), label: 'Conta' }];
  let cur = tree;
  for (let i = 0; i < maxSteps; i++) {
    const s = step(cur);
    if (!s) break;
    cur = s.tree;
    const html = toHTML(cur);
    if (html === out[out.length - 1].html) continue;
    out.push({ html, text: toText(cur), label: s.label });
  }
  return out;
}
