// Teclado próprio no ecrã para o Modo 2: dígitos, sinal, fração, apagar, confirmar.
// Também aceita teclado físico (0-9, "-", "/", Backspace, Enter).

const MAX_DIGITS = 7;

export function createKeypad(root, { onSubmit, onKey } = {}) {
  const st = { neg: false, frac: false, num: '', den: '', focus: 'num', locked: false };

  root.innerHTML = `
    <div class="answer-display" aria-live="polite"></div>
    <div class="keypad">
      ${[7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
      <button class="key key-fn" data-k="del" aria-label="Apagar">⌫</button>
      ${[4, 5, 6].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
      <button class="key key-fn" data-k="neg" aria-label="Sinal menos">−</button>
      ${[1, 2, 3].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
      <button class="key key-fn key-frac" data-k="frac" aria-label="Fração">
        <span class="fr"><span class="fn">a</span><span class="fd">b</span></span>
      </button>
      <button class="key key-zero" data-k="0">0</button>
      <button class="key key-ok" data-k="ok" aria-label="Confirmar">✓</button>
    </div>`;
  const display = root.querySelector('.answer-display');

  function render() {
    const sign = st.neg ? '<span class="ad-sign">−</span>' : '';
    if (!st.frac) {
      display.innerHTML = `${sign}<span class="ad-box ad-int ${st.num ? '' : 'empty'} focus">${st.num || '?'}</span>`;
    } else {
      display.innerHTML = `${sign}<span class="ad-frac">
        <span class="ad-box ${st.focus === 'num' ? 'focus' : ''} ${st.num ? '' : 'empty'}" data-f="num">${st.num || '&nbsp;'}</span>
        <span class="ad-bar"></span>
        <span class="ad-box ${st.focus === 'den' ? 'focus' : ''} ${st.den ? '' : 'empty'}" data-f="den">${st.den || '&nbsp;'}</span>
      </span>`;
    }
  }

  function press(k) {
    if (st.locked) return;
    onKey?.(k);
    if (/^\d$/.test(k)) {
      const f = st.frac ? st.focus : 'num';
      if (st[f].length >= MAX_DIGITS) return;
      st[f] = st[f] === '0' ? k : st[f] + k;
    } else if (k === 'neg') {
      st.neg = !st.neg;
    } else if (k === 'frac') {
      if (!st.frac) { st.frac = true; st.focus = st.num ? 'den' : 'num'; }
      else { st.focus = st.focus === 'num' ? 'den' : 'num'; }
    } else if (k === 'del') {
      if (st.frac) {
        if (st[st.focus]) st[st.focus] = st[st.focus].slice(0, -1);
        else if (st.focus === 'den') st.focus = 'num';
        else { st.frac = false; st.den = ''; }
      } else if (st.num) st.num = st.num.slice(0, -1);
      else st.neg = false;
    } else if (k === 'ok') {
      onSubmit?.({ neg: st.neg, frac: st.frac, num: st.num, den: st.den });
      return;
    }
    render();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { press(b.dataset.k); return; }
    const box = e.target.closest('[data-f]');
    if (box) { st.focus = box.dataset.f; render(); }
  });

  function onKeydown(e) {
    if (!root.isConnected) { window.removeEventListener('keydown', onKeydown); return; }
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === '-') press('neg');
    else if (e.key === '/') press('frac');
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') { e.preventDefault(); press('ok'); }
    else return;
  }
  window.addEventListener('keydown', onKeydown);

  render();
  return {
    clear() { Object.assign(st, { neg: false, frac: false, num: '', den: '', focus: 'num' }); render(); },
    lock(v = true) { st.locked = v; root.classList.toggle('locked', v); },
    destroy() { window.removeEventListener('keydown', onKeydown); },
    shake() { display.classList.remove('shake'); void display.offsetWidth; display.classList.add('shake'); },
  };
}
