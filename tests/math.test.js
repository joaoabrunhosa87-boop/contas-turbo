// Testes do motor matemático. Correm no Node (npm test) e no browser (tests/index.html).

import { Q } from '../js/math/rational.js';
import * as E from '../js/math/expr.js';
import { solveSteps } from '../js/math/steps.js';
import { QuestionGen, TYPES } from '../js/math/generators.js';
import { makeOptions, typicalErrors } from '../js/math/distractors.js';
import { checkTyped } from '../js/math/answer.js';
import { RNG } from '../js/math/rng.js';

const { num, neg, add, sub, mul, dvd, pow, frac } = E;

export function runTests(log = console.log) {
  let pass = 0, fail = 0;
  const t = (name, fn) => {
    try { fn(); pass++; } catch (e) { fail++; log(`✗ ${name}\n    ${e.message}`); }
  };
  const eq = (a, b, msg = '') => {
    const sa = String(a), sb = String(b);
    if (sa !== sb) throw new Error(`${msg} esperado ${sb}, obtido ${sa}`);
  };
  const val = (tree) => E.evaluate(tree).toString();

  // ---- Racionais ----
  t('simplifica com MDC', () => eq(new Q(6, 8), '3/4'));
  t('sinal no numerador', () => eq(new Q(3, -6), '-1/2'));
  t('3/4 + 1/2 = 5/4', () => eq(new Q(3, 4).add(new Q(1, 2)), '5/4'));
  t('2/3 × 5/7 = 10/21', () => eq(new Q(2, 3).mul(new Q(5, 7)), '10/21'));
  t('4/5 ÷ 2/3 = 6/5', () => eq(new Q(4, 5).div(new Q(2, 3)), '6/5'));
  t('5/6 − 1/4 = 7/12', () => eq(new Q(5, 6).sub(new Q(1, 4)), '7/12'));
  t('1/3 + 1/3 + 1/3 = 1 (exato)', () => eq(new Q(1, 3).add(new Q(1, 3)).add(new Q(1, 3)), '1'));
  t('0.1+0.2 problem não existe: 1/10 + 2/10 = 3/10', () => eq(new Q(1, 10).add(new Q(2, 10)), '3/10'));
  t('divisão por zero lança erro', () => {
    let threw = false;
    try { new Q(1).div(new Q(0)); } catch { threw = true; }
    if (!threw) throw new Error('não lançou');
  });
  t('números grandes exatos (BigInt)', () => eq(new Q(2).pow(80), '1208925819614629174706176'));

  // ---- Negativos ----
  t('8 + (−9) = −1', () => eq(val(add(num(8), num(-9))), '-1'));
  t('8 × (−8) = −64', () => eq(val(mul(num(8), num(-8))), '-64'));
  t('(−12) ÷ 4 = −3', () => eq(val(dvd(num(-12), num(4))), '-3'));
  t('−5 − (−3) = −2', () => eq(val(sub(num(-5), num(-3))), '-2'));

  // ---- Potências ----
  t('2³ = 8', () => eq(val(pow(num(2), 3)), '8'));
  t('(−3)² = 9', () => eq(val(pow(num(-3), 2)), '9'));
  t('−3² = −9', () => eq(val(neg(pow(num(3), 2))), '-9'));
  t('(5−2)³ = 27', () => eq(val(pow(sub(num(5), num(2)), 3)), '27'));
  t('7⁰ = 1 e 7¹ = 7', () => { eq(val(pow(num(7), 0)), '1'); eq(val(pow(num(7), 1)), '7'); });
  t('(−2)⁵ = −32', () => eq(val(pow(num(-2), 5)), '-32'));

  // ---- Frações com expressões ----
  t('(8+9)/2 = 17/2', () => eq(val(frac(add(num(8), num(9)), num(2))), '17/2'));
  t('(3²−1)/4 = 2', () => eq(val(frac(sub(pow(num(3), 2), num(1)), num(4))), '2'));
  t('(−6+2)/(−2) = 2', () => eq(val(frac(add(num(-6), num(2)), num(-2))), '2'));

  // ---- Prioridade das operações ----
  const big1 = sub(add(num(8), num(8)), pow(mul(num(9), num(2)), 2));
  t('8 + 8 − (9×2)² = −308', () => eq(val(big1), '-308'));
  const big2 = sub(mul(num(2), pow(num(-3), 2)), dvd(num(4), num(1, 2)));
  t('2 × (−3)² − 4 ÷ (1/2) = 10', () => eq(val(big2), '10'));
  const big3 = sub(pow(add(num(3, 4), num(1, 4)), 2), mul(num(5), num(-2)));
  t('(3/4 + 1/4)² − 5 × (−2) = 11', () => eq(val(big3), '11'));
  t('2 + 3 × 4 = 14 (não 20)', () => eq(val(add(num(2), mul(num(3), num(4)))), '14'));
  t('20 − 8 ÷ 4 × 2 = 16', () => eq(val(sub(num(20), mul(dvd(num(8), num(4)), num(2)))), '16'));
  t('2 × 3² = 18', () => eq(val(mul(num(2), pow(num(3), 2))), '18'));

  // ---- Formatação ----
  t('texto: 8 + (−9)', () => eq(E.toText(add(num(8), num(-9))), '8 + (−9)'));
  t('texto: −5 − (−3)', () => eq(E.toText(sub(num(-5), num(-3))), '−5 − (−3)'));
  t('texto: (−12) ÷ 4', () => eq(E.toText(dvd(num(-12), num(4))), '(−12) ÷ 4'));
  t('texto: −3² vs (−3)²', () => { eq(E.toText(neg(pow(num(3), 2))), '−3²'); eq(E.toText(pow(num(-3), 2)), '(−3)²'); });
  t('texto: 8 + 8 − (9 × 2)²', () => eq(E.toText(big1), '8 + 8 − (9 × 2)²'));
  t('texto: 2 × (3 + 4) tem parênteses', () => eq(E.toText(mul(num(2), add(num(3), num(4)))), '2 × (3 + 4)'));
  t('texto: 10 − (3 − 2) tem parênteses', () => eq(E.toText(sub(num(10), sub(num(3), num(2)))), '10 − (3 − 2)'));
  t('texto: (10 − 3) − 2 sem parênteses', () => eq(E.toText(sub(sub(num(10), num(3)), num(2))), '10 − 3 − 2'));
  t('html: fração com traço e expoente em <sup>', () => {
    const h = E.toHTML(pow(num(3, 4), 2));
    if (!h.includes('class="fr"') || !h.includes('<sup>2</sup>') || !h.includes('class="pa"')) throw new Error(h);
  });
  t('serialização ida e volta', () => {
    const back = E.fromJSON(JSON.parse(JSON.stringify(E.toJSON(big3))));
    eq(val(back), '11'); eq(E.toText(back), E.toText(big3));
  });

  // ---- Passo a passo ----
  t('passos de 8 + 8 − (9×2)²', () => {
    const s = solveSteps(big1).map((x) => x.text);
    eq(s.join(' → '), '8 + 8 − (9 × 2)² → 8 + 8 − 18² → 8 + 8 − 324 → 16 − 324 → −308');
  });
  t('passos de 3/4 + 1/2 usam o mesmo denominador', () => {
    const s = solveSteps(add(num(3, 4), num(1, 2))).map((x) => x.text);
    eq(s.join(' → '), '3/4 + 1/2 → 3/4 + 2/4 → 5/4');
  });
  t('passos de 4/5 ÷ 2/3 multiplicam pelo inverso e simplificam', () => {
    const s = solveSteps(dvd(num(4, 5), num(2, 3))).map((x) => x.text);
    eq(s.join(' → '), '4/5 ÷ 2/3 → 4/5 × 3/2 → 12/10 → 6/5');
  });
  t('passos de −3² terminam em −9', () => {
    const s = solveSteps(neg(pow(num(3), 2)));
    eq(s[s.length - 1].text, '−9');
  });

  // ---- Distratores (erros típicos) ----
  const hasErr = (tree, value) => typicalErrors(tree, E.evaluate(tree)).some((e) => e.value.toString() === value);
  t('distrator −3² = 9', () => { if (!hasErr(neg(pow(num(3), 2)), '9')) throw new Error('falta 9'); });
  t('distrator 2³ = 6', () => { if (!hasErr(pow(num(2), 3), '6')) throw new Error('falta 6'); });
  t('distrator 3/4 + 1/2 = 4/6', () => { if (!hasErr(add(num(3, 4), num(1, 2)), '2/3')) throw new Error('falta 4/6 = 2/3'); });
  t('distrator prioridade 2 + 3 × 4 = 20', () => { if (!hasErr(add(num(2), mul(num(3), num(4))), '20')) throw new Error('falta 20'); });
  t('distrator esquecer o sinal 8 + (−9) = 17 ou 1', () => {
    if (!hasErr(add(num(8), num(-9)), '1')) throw new Error('falta 1');
  });
  t('opções: 4 diferentes e exatamente 1 certa', () => {
    const g = new QuestionGen(new RNG(42));
    for (const ty of TYPES) for (let lvl = 0; lvl < 4; lvl++) for (let i = 0; i < 15; i++) {
      const q = g.make(ty.id, lvl);
      const opts = makeOptions(q, g.r);
      const keys = new Set(opts.map((o) => o.value.toString()));
      if (opts.length !== 4 || keys.size !== 4) throw new Error(`opções repetidas em ${q.text}`);
      if (opts.filter((o) => o.correct).length !== 1) throw new Error('não há exatamente 1 certa');
      if (!opts.find((o) => o.correct).value.eq(q.answer)) throw new Error('opção certa errada');
    }
  });

  // ---- Geradores: limpos, sem repetição, coerentes com os passos ----
  t('geradores: resultados limpos, sem repetições e passos coerentes', () => {
    const g = new QuestionGen(new RNG(7));
    const maxDen = { neg: [1, 1, 1, 1], pot: [1, 1, 100, 1000], frac: [12, 30, 60, 120], fexp: [1, 9, 12, 20], expr: [1, 1, 12, 30] };
    for (const ty of TYPES) for (let lvl = 0; lvl < 4; lvl++) {
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        const q = g.make(ty.id, lvl);
        if (seen.has(q.text)) throw new Error('repetida: ' + q.text);
        seen.add(q.text);
        if (q.answer.d > BigInt(maxDen[ty.id][lvl])) throw new Error(`denominador grande em ${q.text} = ${q.answer}`);
        const steps = solveSteps(q.tree);
        const last = steps[steps.length - 1].text;
        const expected = E.toText(E.numQ(q.answer));
        if (last !== expected) throw new Error(`passos de ${q.text} acabam em ${last}, esperado ${expected}`);
      }
    }
  });
  t('desafio diário determinístico (mesma semente = mesmas contas)', () => {
    const a = new QuestionGen(new RNG('2026-11-08'));
    const b = new QuestionGen(new RNG('2026-11-08'));
    for (let i = 0; i < 10; i++) eq(a.make('expr', 1).text, b.make('expr', 1).text);
  });

  // ---- Respostas escritas ----
  const ty = (neg, num, den) => ({ neg, frac: den !== undefined, num: String(num), den: den === undefined ? '' : String(den) });
  t('6/8 conta como certa para 3/4 (não simplificado)', () => eq(checkTyped(ty(false, 6, 8), new Q(3, 4)).status, 'certoNaoSimplificado'));
  t('6/8 errado se exigir simplificado', () => eq(checkTyped(ty(false, 6, 8), new Q(3, 4), true).status, 'errado'));
  t('8/2 aceite como 4', () => eq(checkTyped(ty(false, 8, 2), new Q(4)).status, 'certoNaoSimplificado'));
  t('−3/4 certo', () => eq(checkTyped(ty(true, 3, 4), new Q(-3, 4)).status, 'certo'));
  t('denominador 0 é inválido', () => eq(checkTyped(ty(false, 3, 0), new Q(1)).status, 'invalido'));
  t('resposta errada', () => eq(checkTyped(ty(false, 5), new Q(4)).status, 'errado'));

  log(`\n${pass} testes passaram, ${fail} falharam.`);
  return { pass, fail };
}
