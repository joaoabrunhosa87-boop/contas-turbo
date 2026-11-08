// Armazenamento local (localStorage), sempre protegido com try/catch.

const PREFIX = 'contasTurbo:';

function read(key, fallback) {
  try {
    const s = localStorage.getItem(PREFIX + key);
    return s ? { ...fallback, ...JSON.parse(s) } : structuredClone(fallback);
  } catch { return structuredClone(fallback); }
}
function readArr(key) {
  try { const s = localStorage.getItem(PREFIX + key); return s ? JSON.parse(s) : []; } catch { return []; }
}
function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* sem espaço / modo privado */ }
}

// ---------- definições ----------
const DEFAULT_SETTINGS = {
  sound: true,
  vibration: true,
  requireSimplified: false,
  perQuestion: 15,       // segundos por pergunta (Modo 1)
  writtenTime: 90,       // segundos por pergunta no Modo 2 (0 = sem tempo)
  theme: 'dark',         // 'dark' | 'light'
  lastName: '',
  lastLevel: 1,
};
export const settings = {
  get() { return read('settings', DEFAULT_SETTINGS); },
  set(patch) { const s = { ...this.get(), ...patch }; write('settings', s); return s; },
};

// ---------- recordes ----------
// chave: `${modo}:${nível}` → [{ name, score, correct, combo, date }]
export const records = {
  all() { return read('records', {}); },
  list(mode, lvl) { return this.all()[`${mode}:${lvl}`] || []; },
  qualifies(mode, lvl, score) {
    if (score <= 0) return false;
    const l = this.list(mode, lvl);
    return l.length < 10 || score > l[l.length - 1].score;
  },
  add(mode, lvl, entry) {
    const all = this.all();
    const k = `${mode}:${lvl}`;
    const l = [...(all[k] || []), entry].sort((a, b) => b.score - a.score).slice(0, 10);
    all[k] = l;
    write('records', all);
    return l.indexOf(entry);
  },
};

// ---------- estatísticas ----------
const DEFAULT_STATS = {
  total: 0, ok: 0, ms: 0, bestCombo: 0,
  byType: {},           // { neg: { n, ok, ms } }
  negStreak: 0,         // certas seguidas em contas com negativos
  reviewFixed: 0,
  games: 0,
};
export const stats = {
  get() { return read('stats', DEFAULT_STATS); },
  save(s) { write('stats', s); },
  record(type, correct, ms, combo, hasNegatives) {
    const s = this.get();
    s.total++; if (correct) s.ok++; s.ms += ms;
    s.bestCombo = Math.max(s.bestCombo, combo);
    const t = s.byType[type] || { n: 0, ok: 0, ms: 0 };
    t.n++; if (correct) t.ok++; t.ms += ms;
    s.byType[type] = t;
    if (hasNegatives) s.negStreak = correct ? s.negStreak + 1 : 0;
    this.save(s);
    return s;
  },
};

// ---------- conquistas ----------
export const achievements = {
  get() { return read('achievements', {}); },  // { id: data ISO }
  unlock(id) {
    const a = this.get();
    if (a[id]) return false;
    a[id] = new Date().toISOString();
    write('achievements', a);
    return true;
  },
};

// ---------- revisão de erros ----------
// [{ tree (JSON), type, lvl, text, wrong, date }]
export const review = {
  list() { return readArr('review'); },
  add(item) {
    const l = this.list().filter((x) => x.text !== item.text);
    l.unshift(item);
    write('review', l.slice(0, 60));
  },
  remove(text) { write('review', this.list().filter((x) => x.text !== text)); },
};

// ---------- desafio diário ----------
// { 'AAAA-MM-DD': { score, correct, grid:[true,false,...], name } }
export const daily = {
  all() { return read('daily', {}); },
  get(date) { return this.all()[date] || null; },
  set(date, result) { const a = this.all(); a[date] = result; write('daily', a); },
};

export function resetAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* nada */ }
}
