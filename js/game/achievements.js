// Conquistas / medalhas. Cada uma tem uma condição verificada depois de cada resposta
// (ctx.event = 'answer') ou no fim de uma partida (ctx.event = 'end').

import { achievements as store } from '../storage.js';

export const ACHIEVEMENTS = [
  { id: 'primeira', icon: '🌱', name: 'Primeiro passo', desc: 'Acerta a tua primeira conta.',
    test: ({ stats }) => stats.ok >= 1 },
  { id: 'relampago', icon: '⚡', name: 'Relâmpago', desc: 'Responde certo em menos de 2 segundos.',
    test: ({ event, correct, ms }) => event === 'answer' && correct && ms < 2000 },
  { id: 'reiNegativos', icon: '👑', name: 'Rei dos Negativos', desc: '50 certas seguidas em contas com negativos.',
    test: ({ stats }) => stats.negStreak >= 50 },
  { id: 'combo10', icon: '🔥', name: 'Em chamas', desc: 'Faz um combo de 10.',
    test: ({ session }) => session && session.bestCombo >= 10 },
  { id: 'combo25', icon: '🚀', name: 'Imparável', desc: 'Faz um combo de 25.',
    test: ({ session }) => session && session.bestCombo >= 25 },
  { id: 'potencias', icon: '💪', name: 'Senhor das Potências', desc: '100 potências certas.',
    test: ({ stats }) => (stats.byType.pot?.ok || 0) >= 100 },
  { id: 'fracoes', icon: '🍕', name: 'Mestre das Frações', desc: '100 frações certas (simples ou com expressões).',
    test: ({ stats }) => (stats.byType.frac?.ok || 0) + (stats.byType.fexp?.ok || 0) >= 100 },
  { id: 'arquiteto', icon: '🏛️', name: 'Arquiteto', desc: '50 expressões grandes certas.',
    test: ({ stats }) => (stats.byType.expr?.ok || 0) >= 50 },
  { id: 'cem', icon: '💯', name: 'Centena', desc: 'Resolve 100 contas.',
    test: ({ stats }) => stats.total >= 100 },
  { id: 'mil', icon: '🧮', name: 'Calculadora Humana', desc: 'Resolve 1000 contas.',
    test: ({ stats }) => stats.total >= 1000 },
  { id: 'perfeito', icon: '💎', name: 'Sem mácula', desc: '20 certas numa partida sem perder vidas.',
    test: ({ session }) => session && Number.isFinite(session.cfg.lives) && !session.lostLife && session.correct >= 20 },
  { id: 'insano', icon: '🤯', name: 'Coragem Insana', desc: '3000 pontos numa partida no Insano.',
    test: ({ session }) => session && session.cfg.lvl === 3 && session.score >= 3000 },
  { id: 'diario', icon: '📅', name: 'Diário em dia', desc: 'Completa um Desafio Diário.',
    test: ({ event, session }) => event === 'end' && session?.cfg.mode === 'diario' },
  { id: 'diario10', icon: '🎯', name: 'Dez em dez', desc: '10/10 no Desafio Diário.',
    test: ({ event, session }) => event === 'end' && session?.cfg.mode === 'diario' && session.correct === 10 },
  { id: 'duelo', icon: '🤝', name: 'Frente a frente', desc: 'Joga um duelo a 2 jogadores.',
    test: ({ event }) => event === 'duel' },
  { id: 'revisor', icon: '📚', name: 'Aprende com os erros', desc: 'Corrige 10 contas na Revisão de erros.',
    test: ({ stats }) => stats.reviewFixed >= 10 },
];

/** Verifica todas as conquistas; devolve as que foram desbloqueadas agora. */
export function checkAchievements(ctx) {
  const got = store.get();
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id]) continue;
    let ok = false;
    try { ok = a.test(ctx); } catch { ok = false; }
    if (ok && store.unlock(a.id)) fresh.push(a);
  }
  return fresh;
}
