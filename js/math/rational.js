// Números racionais EXATOS com BigInt. Nunca usa vírgula flutuante.
// Q é imutável: todas as operações devolvem um novo Q já simplificado (MDC).

const abs = (x) => (x < 0n ? -x : x);

export function gcd(a, b) {
  a = abs(a); b = abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

export function lcm(a, b) {
  if (a === 0n || b === 0n) return 0n;
  return abs(a * b) / gcd(a, b);
}

function big(x) {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) throw new Error('Q só aceita inteiros: ' + x);
    return BigInt(x);
  }
  if (typeof x === 'string') return BigInt(x);
  throw new Error('Valor inválido: ' + x);
}

export class Q {
  constructor(n, d = 1n) {
    n = big(n); d = big(d);
    if (d === 0n) throw new DivisionByZero();
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
    Object.freeze(this);
  }

  static of(n, d = 1n) { return new Q(n, d); }
  static get ZERO() { return ZERO; }
  static get ONE() { return ONE; }

  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d); }
  div(o) {
    if (o.n === 0n) throw new DivisionByZero();
    return new Q(this.n * o.d, this.d * o.n);
  }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(abs(this.n), this.d); }
  inv() { return new Q(this.d, this.n); }

  /** Potência de expoente inteiro (pode ser negativo, desde que a base não seja 0). */
  pow(e) {
    e = big(e);
    if (e === 0n) return ONE;
    if (e < 0n) return this.inv().pow(-e);
    return new Q(this.n ** e, this.d ** e);
  }

  isInt() { return this.d === 1n; }
  isZero() { return this.n === 0n; }
  isNeg() { return this.n < 0n; }
  sign() { return this.n === 0n ? 0 : this.n < 0n ? -1 : 1; }
  eq(o) { return this.n === o.n && this.d === o.d; }
  cmp(o) { const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }

  /** Maior valor absoluto entre numerador e denominador (mede a "limpeza" do número). */
  size() { const a = abs(this.n); return a > this.d ? a : this.d; }

  toString() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
  toJSON() { return this.toString(); }
  toNumber() { return Number(this.n) / Number(this.d); } // só para estatísticas/ordenar, nunca para cálculo

  static parse(s) {
    s = String(s).trim().replace('−', '-');
    const m = /^(-?\d+)(?:\/(-?\d+))?$/.exec(s);
    if (!m) throw new Error('Não é um racional: ' + s);
    return new Q(BigInt(m[1]), m[2] !== undefined ? BigInt(m[2]) : 1n);
  }
}

export class DivisionByZero extends Error {
  constructor() { super('Divisão por zero'); this.name = 'DivisionByZero'; }
}

const ZERO = new Q(0n);
const ONE = new Q(1n);
