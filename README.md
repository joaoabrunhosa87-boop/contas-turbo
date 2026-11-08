# Contas Turbo

PWA de treino de cálculo (negativos, potências, frações, frações com expressões e prioridade das operações).
HTML + CSS + JavaScript (módulos ES), sem frameworks nem dependências.

## Correr

```bash
node serve.js        # http://localhost:8080
npm test             # testes do motor matemático (também em /tests/index.html)
```

Os módulos ES e o service worker **não** funcionam abrindo o `index.html` com duplo clique (file://):
é preciso um servidor. Para instalar no telemóvel, publica a pasta num alojamento estático com HTTPS
(GitHub Pages, Netlify, Cloudflare Pages…) e no browser do telemóvel escolhe "Instalar aplicação" /
"Adicionar ao ecrã principal".

## Estrutura

| Pasta / ficheiro | O que faz |
|---|---|
| `js/math/rational.js` | Racionais exatos com BigInt, sempre simplificados (MDC) |
| `js/math/expr.js` | Árvore de expressões, avaliação, parênteses automáticos, HTML (traço de fração, `<sup>`) |
| `js/math/steps.js` | Resolução passo a passo (parênteses → potências → × ÷ → + −) |
| `js/math/generators.js` | Geradores procedurais por tipo e nível, com validação de resultados "limpos" |
| `js/math/distractors.js` | Opções erradas a partir de erros típicos, com explicação |
| `js/math/answer.js` | Verificação da resposta escrita (equivalentes, simplificação) |
| `js/game/session.js` | Lógica de jogo: pontos, bónus de rapidez, combo, vidas, tempo, desafio diário |
| `js/game/achievements.js` | Conquistas |
| `js/storage.js` | localStorage: definições, recordes, estatísticas, conquistas, revisão de erros |
| `js/ui/*`, `js/app.js` | Interface (ecrãs, teclado, duelo) |
| `js/fx.js` | Sons (Web Audio), vibração, confettis |
| `tests/` | Testes do motor |
