/* OliAmo – sezioni a tendina.
   Ogni elemento con data-fold="nome" si apre e si chiude toccando il suo titolo (il primo <h2>).
   data-fold-open = aperta la prima volta; poi la pagina ricorda la scelta su questo telefono/computer. */
(function () {
  const K = 'oli-fold:' + location.pathname;
  let st = {};
  try { st = JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) { st = {}; }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) {} };
  const css = document.createElement('style');
  css.textContent = `[data-fold]>.fold-h{cursor:pointer;user-select:none;-webkit-user-select:none;display:flex;align-items:center;gap:8px;margin-bottom:0}
[data-fold]>.fold-h::after{content:'▾';margin-left:auto;font-size:1.1rem;color:var(--muted,#888);transition:transform .2s}
[data-fold]:not(.folded)>.fold-h{margin-bottom:14px}
[data-fold]:not(.folded)>.fold-h::after{transform:rotate(180deg)}
[data-fold].folded>:not(.fold-h){display:none!important}
[data-fold]>.fold-h>.fold-b{all:unset;box-sizing:border-box;flex:1;min-height:44px;display:flex;align-items:center;gap:8px;cursor:pointer;font:inherit;color:inherit}
[data-fold]>.fold-h>.fold-b:focus-visible{outline:2px solid var(--brand,#b45309);outline-offset:4px;border-radius:6px}`;
  document.head.appendChild(css);
  const set = (el, open) => {
    el.classList.toggle('folded', !open);
    const b = el.querySelector(':scope > .fold-h > .fold-b'); if (b) b.setAttribute('aria-expanded', open);
  };
  function init(root) {
    (root || document).querySelectorAll('[data-fold]').forEach(el => {
      if (el.dataset.foldOk) return;
      const h = el.querySelector(':scope > h2'); if (!h) return;
      el.dataset.foldOk = '1';
      h.classList.add('fold-h');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fold-b';
      while (h.firstChild) b.appendChild(h.firstChild);
      h.appendChild(b);
      const k = el.dataset.fold;
      set(el, k in st ? !!st[k] : el.hasAttribute('data-fold-open'));
      const tog = () => {
        const open = el.classList.contains('folded');
        set(el, open); st[k] = open; save();
        if (open) setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
      };
      h.addEventListener('click', e => { const x = e.target.closest('a,button,input,select'); if (x && x !== b) return; tog(); });
    });
  }
  window.OviFold = { init, open: (k, v) => { const el = document.querySelector(`[data-fold="${k}"]`); if (el) { set(el, v !== false); st[k] = v !== false; save(); } } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();
