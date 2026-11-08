// Gerador pseudo-aleatório com semente (mulberry32), para o Desafio Diário ser igual para todos.

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** inteiro em [a, b] */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  /** inteiro em [a, b] sem o zero */
  nz(a, b) { let x; do { x = this.int(a, b); } while (x === 0); return x; }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(pairs) { // [[valor, peso], ...]
    const tot = pairs.reduce((s, p) => s + p[1], 0);
    let x = this.next() * tot;
    for (const [v, w] of pairs) { if ((x -= w) < 0) return v; }
    return pairs[pairs.length - 1][0];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
