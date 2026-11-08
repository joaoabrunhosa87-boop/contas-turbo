// Verificação de respostas escritas (Modo 2): aceita equivalentes (6/8 = 3/4, 8/2 = 4).

import { Q, gcd } from './rational.js';

/**
 * typed: { neg:bool, frac:bool, num:string, den:string }  (num = parte inteira quando frac=false)
 * Devolve { ok:bool, value:Q|null, raw:[n,d]|null, error?:string }
 */
export function parseTyped(typed) {
  const top = typed.num.trim();
  if (!top) return { ok: false, error: 'Escreve um número.' };
  let n = BigInt(top);
  if (typed.neg) n = -n;
  if (!typed.frac) return { ok: true, value: new Q(n), raw: [n, 1n] };
  const bot = typed.den.trim();
  if (!bot) return { ok: false, error: 'Falta o denominador.' };
  const d = BigInt(bot);
  if (d === 0n) return { ok: false, error: 'O denominador não pode ser 0.' };
  return { ok: true, value: new Q(n, d), raw: [n, d] };
}

export function isSimplifiedRaw([n, d]) {
  if (d === 1n) return true;
  return gcd(n, d) === 1n;
}

/**
 * Compara a resposta escrita com a certa.
 * Devolve { status: 'certo' | 'certoNaoSimplificado' | 'errado' | 'invalido', value, message }
 */
export function checkTyped(typed, answer, requireSimplified = false) {
  const p = parseTyped(typed);
  if (!p.ok) return { status: 'invalido', value: null, message: p.error };
  if (!p.value.eq(answer)) return { status: 'errado', value: p.value };
  if (isSimplifiedRaw(p.raw)) return { status: 'certo', value: p.value };
  return {
    status: requireSimplified ? 'errado' : 'certoNaoSimplificado',
    value: p.value,
    message: requireSimplified ? 'Está certo, mas falta simplificar.' : 'Certo! Simplificado fica',
  };
}
