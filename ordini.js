/* OliAmo – scheda di un ordine: olio consegnato (litri) e soldi ricevuti, anche in parte o in anticipo.
   Ogni "movimento" registra insieme litri consegnati e/o soldi incassati.
   OliOrd.row(o) / mini(o)                        → HTML della scheda / riga compatta
   OliOrd.bind(contenitore, post, ricarica, getOrdine) → gestisce i pulsanti
   OliOrd.stock(el, post, ricarica, {mano})       → olio disponibile + olio dato a mano */
(function () {
  const css = `
.oo{display:grid;gap:10px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.oo.done{opacity:.85}
.oo-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.oo-h b.nm{font-size:1rem}
.oo-w{color:var(--muted);font-size:.84rem;margin-top:2px}
.oo-w a{color:inherit}
.oo-e{text-align:right;white-space:nowrap}
.oo-e b{font-family:Fraunces,Georgia,serif;font-size:1.05rem;display:block}
.oo-e small{color:var(--muted);font-size:.78rem}
.oo-nt{font-size:.85rem;color:var(--muted);font-style:italic}
.oo-s2{display:flex;flex-wrap:wrap;gap:6px}
.oo-s2 span{font-size:.86rem;padding:5px 10px;border-radius:10px;background:var(--bg)}
.oo-s2 .r{color:var(--err)}.oo-s2 .ok{color:var(--brand)}.oo-s2 b{color:var(--ink)}
.om{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
.om-h{display:grid;grid-template-columns:1fr auto auto auto 14px;gap:10px;align-items:center;width:100%;padding:10px 12px;border:0;background:none;color:var(--ink);font:500 .9rem Inter,sans-serif;text-align:left;cursor:pointer}
.om-h b{font-weight:700}.om-h .om-d{color:var(--muted);font-size:.82rem;white-space:nowrap}.om-h .om-u{white-space:nowrap}.om-h .om-e{font-weight:700;white-space:nowrap}
.om-h .om-c{color:var(--muted);transition:transform .2s}.om.op .om-h .om-c{transform:rotate(90deg)}
.om-h .om-r{grid-column:1/-2;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.82rem;font-weight:500}.om-r .r{color:#b45309}.om-r .r b{font-weight:800}.om-r .ok,.om-r.ok{color:#15803d}
.om.op .om-h{border-bottom:1px solid var(--line);background:var(--bg)}
.om>.oo{border:0;border-radius:0}
.om>.oo>.oo-h b.nm,.om>.oo>.oo-h .oo-e{display:none}
@media (max-width:480px){.om-h{grid-template-columns:1fr auto 14px;row-gap:2px}.om-h .om-d{grid-column:1;grid-row:2}.om-h .om-u{grid-column:2;grid-row:2;text-align:right;color:var(--muted);font-size:.82rem}.om-h .om-e{grid-column:2;grid-row:1}.om-h .om-c{grid-column:3;grid-row:1/3}}
.oo-s{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.oo-b{border-radius:12px;padding:8px 10px;background:var(--bg);display:grid;gap:4px;font-size:.84rem}
.oo-b .k{color:var(--muted);font-size:.76rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.oo-b .v{font-size:.95rem}
.oo-b .r{font-weight:700;color:var(--err)}
.oo-b .ok{font-weight:700;color:var(--brand)}
.oo-bar{height:6px;border-radius:9px;background:var(--line);overflow:hidden}
.oo-bar i{display:block;height:100%;background:var(--brand-2)}
.oo-a{display:flex;flex-wrap:wrap;gap:6px}
.oo button.ob{display:inline-flex;align-items:center;gap:5px;min-height:40px;padding:7px 14px;border:1px solid var(--line);border-radius:99px;background:var(--bg);color:var(--ink);font:600 .82rem Inter,sans-serif;cursor:pointer}
.oo button.ob:hover{border-color:var(--brand-2)}
.oo a.ob{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:99px;font:700 .82rem Inter,sans-serif;text-decoration:none}
.oo button.ob.pr{background:var(--brand);border-color:var(--brand);color:#fff}
@media (prefers-color-scheme:dark){.oo button.ob.pr{color:#13200c}}
.oo .sp{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;background:#e8433d;color:#fff;font:800 .62rem Inter,sans-serif}
.oo-f{display:grid;gap:10px;padding:10px;border:1.5px solid var(--brand-2);border-radius:12px;background:color-mix(in srgb,var(--brand-2) 6%,var(--card))}
.oo-f h4{margin:0;font-size:.92rem}
.oo-q{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.88rem}
.oo-q .lb{flex:1 1 100%;font-weight:600}
.oo-q input{width:84px;font:inherit;font-size:.95rem;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);text-align:center}
.oo-q .st{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--brand);font-size:1.1rem;cursor:pointer}
.oo-q.ask{padding:8px;border-radius:10px;background:color-mix(in srgb,var(--yolk) 30%,var(--card))}
.oo-q.ask .lb small{font-weight:500;color:var(--muted)}
.oo-q.shake{animation:ooShake .4s;outline:2px solid var(--err)}
@keyframes ooShake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.oo-m{display:flex;gap:6px;flex-wrap:wrap}
.oo-m button{min-height:40px;padding:7px 12px;border-radius:99px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);font:600 .82rem Inter,sans-serif;cursor:pointer}
.oo-m button.on{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 16%,var(--card));color:var(--ink)}
.oo-sum{font-size:.86rem;padding:8px 10px;border-radius:10px;background:var(--card);border:1px dashed var(--line)}
.oo-del{color:var(--err)!important;font-size:.8rem!important}
.oo-lk{border:0;background:none;padding:10px 4px;color:var(--brand);text-decoration:underline;cursor:pointer;font:inherit;font-size:.84rem}
.oo .pp{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;background:#1f4fa0;color:#fff;font:800 italic .62rem Inter,sans-serif}
.oo-k{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}
.oo-kd{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink);font:600 .88rem Inter,sans-serif;cursor:pointer}
.oo-kd .ck{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;border:2px solid var(--muted);background:var(--card);color:#fff;font-size:.8rem;line-height:1}
.oo-kd.on{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 14%,var(--card))}
.oo-kd.on .ck{background:var(--brand);border-color:var(--brand)}
.oo-kp{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);font:600 .88rem Inter,sans-serif}
.oo-kp.on{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 14%,var(--card))}
.oo-kp button{display:inline-grid;place-items:center;width:44px;height:40px;border:1.5px solid var(--line);border-radius:9px;background:var(--card);cursor:pointer;padding:0}
.oo-kp button{position:relative;transition:transform .15s}
.oo-kp button.on{border:2px solid var(--brand);background:var(--brand);transform:scale(1.1);box-shadow:0 2px 8px color-mix(in srgb,var(--brand) 45%,transparent)}
.oo-kp button.on::after{content:'✓';position:absolute;top:-8px;right:-8px;width:18px;height:18px;border-radius:50%;background:#fff;color:var(--brand);border:2px solid var(--brand);font:900 .68rem/14px Inter,sans-serif;text-align:center}
.oo-kp.on button:not(.on){opacity:.3;filter:grayscale(1)}
.oo-kp.on{border-width:2px;border-color:var(--brand);background:color-mix(in srgb,var(--brand-2) 22%,var(--card));color:var(--brand)}
.oo-kp .mt{font-weight:800}
.oo-kp button .sp,.oo-kp button .pp{width:20px;height:20px;font-size:.75rem}
.oo-kp svg{width:24px;height:16px}
.oo-adv{border:1px solid var(--line);border-radius:12px;padding:0 10px}
.oo-adv[open]{padding-bottom:10px}
.oo-adv>summary{cursor:pointer;padding:12px 0;min-height:44px;box-sizing:border-box;font:600 .86rem Inter,sans-serif;color:var(--muted);list-style:none}
.oo-adv>summary::-webkit-details-marker{display:none}
.oo-adv>div{display:grid;gap:10px}
.oo-badge.rj{background:var(--bg);color:var(--muted)}
.oo-hist summary{cursor:pointer;font-size:.82rem;color:var(--muted);list-style:none}
.oo-hist summary::-webkit-details-marker{display:none}
.oo-pl{display:grid;gap:4px;font-size:.82rem;margin-top:6px}
.oo-pl span{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.oo-pl button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:0 4px}
.oo-badge{font:700 .7rem Inter,sans-serif;padding:1px 8px;border-radius:99px;background:color-mix(in srgb,var(--yolk) 45%,var(--card));color:#6b4a00;vertical-align:2px}
.oo-badge.mn{background:color-mix(in srgb,#8a5cf6 18%,var(--card));color:#4b2a9a}
.os{display:grid;gap:10px}
.os-n{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.os-n div{border-radius:12px;padding:10px 12px;background:var(--bg);display:grid;gap:2px}
.os-n small{color:var(--muted);font-size:.78rem;line-height:1.25}
.os-n b{font-family:Fraunces,Georgia,serif;font-size:1.9rem;line-height:1.05;color:var(--brand)}
.os-n b.neg{color:var(--err)}
.os-n.one{grid-template-columns:1fr}
.mh-s{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.mh-s span{font-size:.84rem;padding:4px 10px;border-radius:10px;background:var(--bg)}.mh-s .r{color:var(--err)}
.mh-l{display:grid;gap:4px}
.mh-r{display:grid;grid-template-columns:auto 1fr auto auto auto;gap:8px;align-items:center;font-size:.85rem;padding:6px 8px;border-radius:9px;background:var(--bg)}
.mh-r .d{color:var(--muted);font-size:.8rem}.mh-r .r{color:var(--err);font-weight:600}.mh-r .ok{color:var(--brand);font-weight:600}
@media (max-width:480px){.mh-r{grid-template-columns:auto 1fr auto}.mh-r>span:nth-child(4){display:none}}
.os form{display:grid;gap:8px;padding-top:4px}
.os .rw{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.os input{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);min-width:0}
.os input[type=number]{width:90px;text-align:center}
.os .hint{color:var(--muted);font-size:.8rem}
.os-w{margin:0;padding:8px 10px;border-radius:10px;font-size:.84rem;background:color-mix(in srgb,var(--err) 10%,var(--card));color:var(--ink)}
.card>.os>.oo-adv:only-child{border:0;padding:0}
.card>.os>.oo-adv:only-child>summary{font-size:1.02rem;color:var(--ink);padding:2px 0}
@media (max-width:420px){.oo-s{grid-template-columns:1fr}}`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const eur = n => r2(n).toFixed(2).replace('.', ',') + ' €';
  const num = s => parseFloat(String(s || '').replace(',', '.')) || 0;
  const dIt = s => { const d = String(s || '').slice(0, 10).split('-'); return d.length === 3 ? `${+d[2]}/${+d[1]}/${d[0].slice(2)}` : ''; };
  const paid = o => +o.paid || 0;
  const rest = o => Math.max(0, r2(o.euro - paid(o)));
  const cons = o => Math.min(o.litri, +o.consegnati || 0);
  const left = o => Math.max(0, o.litri - cons(o));
  const done = o => rest(o) <= 0.005 && left(o) <= 0;
  const unit = o => o.litri ? o.euro / o.litri : 0;
  const ltN = n => String(r2(n)).replace('.', ',');
  const lt = n => ltN(n) + ' lt';
  const pz = o => Array.isArray(o.pezzi) && o.pezzi.length ? o.pezzi : [o.q3 ? { tipo: 'lattina', lt: 3, n: o.q3 } : null, o.q5 ? { tipo: 'lattina', lt: 5, n: o.q5 } : null].filter(Boolean);
  /** "2 × latt. 3 lt + 1 × bott. 0,5 lt" */
  const latt = o => pz(o).map(x => `${x.n} × ${x.tipo === 'bottiglia' ? 'bott.' : 'latt.'} ${lt(x.lt)}`).join(' + ');
  /** passo dei +/−: un pezzo se l'ordine ha un solo formato, altrimenti 1 litro (o mezzo, o un quarto) */
  const step = o => { const P = pz(o); if (P.length === 1) return P[0].lt; return P.every(x => Number.isInteger(x.lt)) ? 1 : P.every(x => Number.isInteger(x.lt * 2)) ? 0.5 : 0.25; };
  // Icone dei formati: lattina e bottiglia, la grandezza dipende dai litri
  const TIN = '<rect x="5" y="9" width="38" height="49" rx="4" fill="#3D7A0E"/><rect x="5" y="9" width="38" height="5" rx="2" fill="#FFC21A"/><rect x="5" y="53" width="38" height="5" rx="2" fill="#FFC21A"/><rect x="19" y="3" width="10" height="7" rx="2" fill="#FFC21A" stroke="#B88A00" stroke-width="1"/><rect x="10" y="19" width="28" height="29" rx="4" fill="#FFF3C4"/><path d="M14 42 C19 38 24 33 33 26" stroke="#6B4A1E" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="19" cy="36" rx="2" ry="4.2" transform="rotate(-40 19 36)" fill="#5C9E1A"/><ellipse cx="27" cy="30" rx="2" ry="4.2" transform="rotate(50 27 30)" fill="#8CC63F"/><path d="M29 34 C29 34 25 39 25 41.5 C25 43.5 26.8 45 29 45 C31.2 45 33 43.5 33 41.5 C33 39 29 34 29 34Z" fill="#FFC21A"/><rect x="8" y="16" width="2.4" height="35" rx="1.2" fill="#fff" opacity=".22"/>';
  const BOT = '<rect x="8" y="1" width="8" height="5.5" rx="1" fill="#FFC21A" stroke="#B88A00" stroke-width=".7"/><rect x="7.6" y="6" width="8.8" height="2.2" rx=".8" fill="#E0A000"/><rect x="9.6" y="8.2" width="4.8" height="5.3" fill="#2F520C"/><path d="M9.6 13.5 L14.4 13.5 L20.6 19.5 L20.6 61.2 Q20.6 63 18.8 63 L5.2 63 Q3.4 63 3.4 61.2 L3.4 19.5 Z" fill="#2F520C"/><path d="M14.4 13.5 L20.6 19.5 L20.6 61.2 Q20.6 63 18.8 63 L15.6 63 L15.6 19.5 Z" fill="#1F3A07"/><rect x="5" y="29" width="9" height="21" rx="1" fill="#FFF3C4"/><path d="M9.5 32.5 C9.5 32.5 7 35.8 7 37.6 C7 39 8.1 40.1 9.5 40.1 C10.9 40.1 12 39 12 37.6 C12 35.8 9.5 32.5 9.5 32.5Z" fill="#FFC21A"/><ellipse cx="7.6" cy="45" rx="1" ry="2.4" transform="rotate(-55 7.6 45)" fill="#5C9E1A"/><ellipse cx="11.4" cy="45" rx="1" ry="2.4" transform="rotate(55 11.4 45)" fill="#8CC63F"/><rect x="4.4" y="21" width="1.3" height="39" rx=".6" fill="#fff" opacity=".22"/>';
  /** f = {tipo, lt}; maxLt = litri del formato più grande; H = altezza massima in px */
  function ico(f, maxLt, H) {
    const s = Math.sqrt(Math.min(1, f.lt / (maxLt || f.lt)));
    const h = Math.round(Math.min(H, H * (0.34 + 0.66 * s) * (f.tipo === 'bottiglia' ? 1.25 : 1)));
    return f.tipo === 'bottiglia'
      ? `<svg width="${Math.round(h * 24 / 64)}" height="${h}" viewBox="0 0 24 64" aria-hidden="true">${BOT}</svg>`
      : `<svg width="${Math.round(h * 48 / 60)}" height="${h}" viewBox="0 0 48 60" aria-hidden="true">${TIN}</svg>`;
  }
  const CASH = '<svg viewBox="0 0 24 16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" rx="2.5" fill="#E3F2C8" stroke="#3D7A0E" stroke-width="1.6"/><circle cx="12" cy="8" r="3.4" fill="none" stroke="#3D7A0E" stroke-width="1.6"/><circle cx="5" cy="8" r="1.1" fill="#3D7A0E"/><circle cx="19" cy="8" r="1.1" fill="#3D7A0E"/></svg>';
  const ICO = { contanti: CASH, satispay: '<span class="sp">S</span>', paypal: '<span class="pp">P</span>' };
  const MNAME = { contanti: 'in contanti', satispay: 'con Satispay', paypal: 'con PayPal' };
  const MET = { contanti: '💶 Contanti', satispay: '<span class="sp">S</span> Satispay', paypal: '<span class="pp">P</span> PayPal' };
  const usedM = o => [...new Set((o.payments || []).filter(m => m.euro > 0).map(m => m.metodo))];
  const forms = new Map();   // id → { mode, n, e, m, eTouched }
  const advOpen = new Set();   // schede con "Gestione avanzata" aperta (resta aperta quando la scheda si ridisegna)
  const addCss = () => { if (!document.getElementById('ooCss')) { const s = document.createElement('style'); s.id = 'ooCss'; s.textContent = css; document.head.appendChild(s); } };

  function sumTxt(o, f) {
    const n = f.n, e = f.m ? r2(f.e) : 0, dl = left(o) - n, dr = r2(rest(o) - e);
    const parts = [];
    if (n) parts.push(`consegni <b>${lt(n)}</b>`);
    if (e > 0) parts.push(`incassi <b>${eur(e)}</b>${f.m ? (' ' + (MNAME[f.m] || 'in contanti')) : ''}`);
    if (!parts.length) return "Scrivi i litri consegnati adesso o i soldi ricevuti adesso.";
    const after = [dl > 0 ? `restano <b>${lt(dl)}</b> da dare` : 'olio tutto consegnato', dr > 0.005 ? `restano <b>${eur(dr)}</b> da avere` : 'tutto pagato'];
    let warn = '';
    if (n && !(e > 0)) warn = " <br>⚠️ L'olio consegnato adesso non risulta pagato.";
    else if (!n && e > 0 && left(o)) warn = ' <br>💡 Pagamento in anticipo.';
    return 'Adesso ' + parts.join(' e ') + '. Dopo: ' + after.join(', ') + '.' + warn;
  }

  const eqOf = (o, f) => Math.min(left(o), unit(o) ? Math.round(r2(f.e) / unit(o)) : 0);
  const eqTxt = n => `Ho consegnato anche i ${lt(n)} di questo importo`;
  function formHtml(o, f) {
    const L = left(o), R = rest(o), eqN = eqOf(o, f);
    return `<form class="oo-f" data-of="${esc(o.id)}">
      <h4>${f.mode === 'pay' ? '💶 Pagamento ricevuto' : '🫒 Olio consegnato'}</h4>
      <div class="oo-q"><span class="lb">Litri consegnati ora</span>
        <button type="button" class="st" data-oa="fn" data-d="-1" aria-label="Meno">−</button>
        <input name="n" type="number" inputmode="decimal" min="0" max="${L}" step="${step(o)}" value="${f.n}" aria-label="Litri consegnati ora">
        <button type="button" class="st" data-oa="fn" data-d="1" aria-label="Più">+</button>
        <small style="color:var(--muted)">su ${lt(L)} da dare</small></div>
      ${f.mode === 'pay' && L ? `<div><button type="button" class="oo-lk" data-oa="fneq" ${eqN && f.n !== eqN ? '' : 'hidden'}>${eqTxt(eqN)}</button></div>` : ''}
      <div class="oo-q${f.mode === 'dlv' && !f.answered ? ' ask' : ''}"><span class="lb">${f.mode === 'dlv' ? 'È pagato? <small>(scegli una risposta)</small>' : 'Pagato ora €'}</span>
        <div class="oo-m">${f.mode === 'dlv' ? `<button type="button" data-oa="fm" data-m="" class="${f.m === '' && f.answered ? 'on' : ''}">Non pagato</button>` : ''}
          <button type="button" data-oa="fm" data-m="contanti" class="${f.m === 'contanti' ? 'on' : ''}">${MET.contanti}</button>
          <button type="button" data-oa="fm" data-m="satispay" class="${f.m === 'satispay' ? 'on' : ''}">${MET.satispay}</button>
          <button type="button" data-oa="fm" data-m="paypal" class="${f.m === 'paypal' ? 'on' : ''}">${MET.paypal}</button></div></div>
      ${f.m ? `<div class="oo-q"><span class="lb">Importo €</span><input name="e" inputmode="decimal" value="${String(r2(f.e)).replace('.', ',')}" aria-label="Importo pagato ora"><small style="color:var(--muted)">su ${eur(R)} da avere</small></div>` : ''}
      <div class="oo-sum">${sumTxt(o, f)}</div>
      <div class="oo-a"><button class="ob pr">Registra</button><button type="button" class="ob" data-oa="fx">Annulla</button></div>
    </form>`;
  }

  /** Riga compatta: nome, data, litri, valore; toccandola si apre la scheda completa */
  const miniOpen = new Set();
  /** Cosa manca: litri ancora da dare e soldi ancora da avere */
  const remTxt = o => {
    const L = left(o), R = rest(o);
    if (!L && R <= 0.005) return '<span class="om-r ok">✓ Consegnato e pagato</span>';
    return `<span class="om-r">${L ? `<span class="r">🫒 Da dare <b>${lt(L)}</b></span>` : '<span class="ok">🫒 Consegnato ✓</span>'}${R > 0.005 ? `<span class="r">💶 Da avere <b>${eur(R)}</b></span>` : '<span class="ok">💶 Pagato ✓</span>'}</span>`;
  };
  const mini = (o, opt) => {
    const op = miniOpen.has(o.id) || forms.has(o.id);
    const d = o.perIl ? 'per ' + new Date(o.perIl + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' }) : dIt(o.data);
    return `<div class="om${op ? ' op' : ''}" data-mid="${esc(o.id)}"><button type="button" class="om-h" data-tg="${esc(o.id)}" aria-expanded="${op}">
      <span class="om-n"><b>${esc(o.nome)} ${esc(o.cognome || '')}</b>${o.mano ? ' <span class="oo-badge mn">🤝</span>' : ''}</span>
      <span class="om-d">${d}</span><span class="om-u">${lt(o.litri)}</span><span class="om-e">${eur(o.euro)}</span><span class="om-c">▸</span>${remTxt(o)}</button>${op ? row(o, opt) : ''}</div>`;
  };
  function row(o, opt) {
    opt = opt || {};
    const L = left(o), R = rest(o), c = cons(o), p = paid(o), f = forms.get(o.id);
    const qty = latt(o);
    const per = o.perIl ? `<b style="color:var(--brand)">per ${new Date(o.perIl + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' })}</b> · ` : '';
    const mv = o.payments || [];
    return `<div class="oo ${done(o) ? 'done' : ''}" data-oid="${esc(o.id)}"${opt.del ? ' data-del="1"' : ''}>
  <div class="oo-h"><div><b class="nm">${esc(o.nome)} ${esc(o.cognome)}</b>${o.mano ? ' <span class="oo-badge mn">🤝 A mano</span>' : ''}
    <div class="oo-w">${per}${dIt(o.data)}${qty ? ` · ${qty}` : ''}${o.telefono ? ` · <a href="tel:${esc(o.telefono)}">${esc(o.telefono)}</a>` : ''}</div></div>
    <div class="oo-e"><b>${eur(o.euro)}</b><small>${lt(o.litri)}</small></div></div>
  ${o.note ? `<div class="oo-nt">“${esc(o.note)}”</div>` : ''}
  <div class="oo-s2"><span class="${L ? 'r' : 'ok'}">🫒 Consegnati <b>${lt(c)}</b> di ${lt(o.litri)}${L ? '' : ' ✓'}</span><span class="${R > 0.005 ? 'r' : 'ok'}">💶 Pagati <b>${eur(p)}</b> di ${eur(o.euro)}${R > 0.005 ? '' : ' ✓'}</span></div>
  <div class="oo-k">
    <button type="button" class="oo-kd ${L ? '' : 'on'}" data-oa="kdlv" aria-pressed="${!L}" title="${L ? "Segna tutto l'olio come consegnato" : 'Togli la consegna'}"><span class="ck">${L ? '' : '✓'}</span>Consegnato</button>
    <div class="oo-kp ${R > 0.005 ? '' : 'on'}"><span>${R > 0.005 ? (usedM(o).length ? 'Pagato in parte' : 'Pagamento') : `✓ Pagato <span class="mt">${usedM(o).map(m => ({ contanti: 'in contanti', satispay: 'Satispay', paypal: 'PayPal' })[m] || '').join(' + ')}</span>`}</span>${['contanti', 'satispay', 'paypal'].map(m => `<button type="button" data-oa="kpay" data-m="${m}" class="${usedM(o).includes(m) ? 'on' : ''}" aria-pressed="${usedM(o).includes(m)}" title="${R > 0.005 ? 'Pagato ' + MNAME[m] : usedM(o).includes(m) ? 'Togli il pagamento' : 'Cambia: pagato ' + MNAME[m]}" aria-label="Pagato ${MNAME[m]}">${ICO[m]}</button>`).join('')}</div>
  </div>
  <details class="oo-adv" data-adv${f || advOpen.has(o.id) ? ' open' : ''}><summary>⚙️ Gestione avanzata ▾</summary><div>
  ${f ? formHtml(o, f) : L || R > 0.005 ? `<div class="oo-a">
    ${L ? `<button type="button" class="ob pr" data-oa="open" data-mode="dlv">🫒 Consegna olio</button>` : ''}
    ${R > 0.005 ? `<button type="button" class="ob pr" data-oa="open" data-mode="pay">💶 Pagamento</button>` : ''}
  </div>` : `<span style="font-size:.84rem;color:var(--muted)">Consegnato e pagato: niente da registrare.</span>`}
  </div></details>
  ${opt.del ? `<div class="oo-a"><button type="button" class="oo-lk oo-del" data-oa="del">🗑️ Elimina</button></div>` : ''}
  ${mv.length ? `<details class="oo-hist"><summary>📋 Movimenti (${mv.length}) ▾</summary><div class="oo-pl">${mv.map(m => `<span>${dIt(m.data)} · ${m.litri ? '🫒 ' + lt(m.litri) + ' consegnati' : ''}${m.litri && m.euro > 0 ? ' · ' : ''}${m.euro > 0 ? '💶 ' + eur(m.euro) + (m.metodo === 'satispay' ? ' Satispay' : m.metodo === 'paypal' ? ' PayPal' : m.metodo === 'contanti' ? ' contanti' : '') : ''}<button type="button" data-oa="pdel" data-pid="${esc(m.id)}" aria-label="Annulla questo movimento">×</button></span>`).join('')}</div></details>` : ''}
</div>`;
  }

  /** Conferma senza finestre del browser (nel browser di Claude confirm() non funziona): secondo tocco entro 4 secondi */
  const armed = new Map();
  const twice = (key, b, msg, toast) => {
    const t = armed.get(key);
    if (t && Date.now() - t < 4000) { armed.delete(key); return true; }
    armed.set(key, Date.now()); toast(msg); b.disabled = false; return false;
  };

  function bind(el, post, reload, getOrder) {
    addCss();
    if (el.dataset.ooBound) return; el.dataset.ooBound = '1';
    const toast = t => (window.toast ? window.toast(t) : alert(t));
    const run = async (body, msg) => {
      try { const j = await post(body); if (!j.ok) throw new Error(j.error || 'Non salvato'); if (msg) toast(msg); await reload(); }
      catch (x) { toast(x.message || 'Non salvato, riprova'); }
    };
    const redraw = id => { const o = getOrder(id), card = el.querySelector(`[data-oid="${CSS.escape(id)}"]`); if (o && card) { card.outerHTML = row(o, { del: card.dataset.del === '1' }); } };
    const autoE = (o, f) => { if (!f.eTouched) f.e = f.mode === 'pay' && !f.n ? rest(o) : Math.min(rest(o), r2(f.n * unit(o))); };
    el.addEventListener('click', e => {
      const tg = e.target.closest('[data-tg]');
      if (tg && el.contains(tg)) { const id = tg.dataset.tg, o = getOrder(id), w = tg.closest('[data-mid]'); if (!o || !w) return;
        miniOpen.has(id) ? (miniOpen.delete(id), forms.delete(id)) : miniOpen.add(id); w.outerHTML = mini(o, { del: true }); return; }
      const b = e.target.closest('[data-oa]'); if (!b || !el.contains(b)) return;
      const card = b.closest('[data-oid]'), id = card && card.dataset.oid, o = getOrder(id); if (!o) return;
      const a = b.dataset.oa, f = forms.get(id);
      if (a === 'open') {
        const mode = b.dataset.mode;
        const nf = { mode, n: mode === 'dlv' ? left(o) : 0, e: 0, m: '', answered: false, eTouched: false };
        if (mode === 'pay') { nf.e = rest(o); nf.m = 'contanti'; nf.answered = true; } else autoE(o, nf);
        forms.set(id, nf); redraw(id); return;
      }
      if (a === 'fx') { forms.delete(id); redraw(id); return; }
      if (a === 'fn' && f) { f.n = r2(Math.max(0, Math.min(left(o), f.n + step(o) * +b.dataset.d))); autoE(o, f); redraw(id); return; }
      if (a === 'fneq' && f) { f.n = eqOf(o, f); redraw(id); return; }
      if (a === 'fm' && f) { f.m = b.dataset.m; f.answered = true; if (f.m) { if (!f.e) { f.eTouched = false; autoE(o, f); } } else f.e = 0; redraw(id); return; }
      b.disabled = true;
      if (a === 'kdlv') {   // "Consegnato": tutto l'olio consegnato / togli la consegna
        const on = left(o) > 0;
        run({ action: 'flag', ids: [id], field: 'consegnato', value: on }, on ? `${o.nome}: olio consegnato ✓` : `${o.nome}: consegna tolta`);
        return;
      }
      if (a === 'kpay') {   // icona del metodo: paga il resto così / tocca di nuovo per togliere / cambia metodo
        const m = b.dataset.m, used = usedM(o);
        if (rest(o) > 0.005) run({ action: 'flag', ids: [id], field: 'pagato', value: true, metodo: m }, `${o.nome}: pagato ${MNAME[m]} ✓`);
        else if (used.length === 1 && used[0] === m) run({ action: 'flag', ids: [id], field: 'pagato', value: false }, `${o.nome}: pagamento tolto`);
        else (async () => {
          try { let j = await post({ action: 'flag', ids: [id], field: 'pagato', value: false }); if (!j.ok) throw new Error(j.error);
            j = await post({ action: 'flag', ids: [id], field: 'pagato', value: true, metodo: m }); if (!j.ok) throw new Error(j.error);
            toast(`${o.nome}: ora pagato ${MNAME[m]}`); await reload(); } catch (x) { toast(x.message || 'Non salvato, riprova'); b.disabled = false; }
        })();
        return;
      }
      if (a === 'del') { if (twice('del' + id, b, `Tocca di nuovo "Elimina" per spostare nel cestino l'ordine di ${o.nome}`, toast)) run({ action: 'delOrders', ids: [id] }, "Spostata nel cestino: l'olio torna disponibile"); }
      else if (a === 'pdel') { if (twice('pdel' + b.dataset.pid, b, 'Tocca di nuovo × per annullare questo movimento', toast)) run({ action: 'payDel', pid: b.dataset.pid }, 'Movimento annullato'); }
    });
    el.addEventListener('toggle', e => { const d = e.target; if (!d.matches || !d.matches('details[data-adv]')) return; const id = d.closest('[data-oid]').dataset.oid; d.open ? advOpen.add(id) : advOpen.delete(id); }, true);
    el.addEventListener('input', e => {
      const fm = e.target.closest('[data-of]'); if (!fm) return;
      const id = fm.dataset.of, o = getOrder(id), f = forms.get(id); if (!o || !f) return;
      if (e.target.name === 'n') { f.n = r2(Math.max(0, Math.min(left(o), num(e.target.value)))); autoE(o, f); }
      if (e.target.name === 'e') { f.e = num(e.target.value); f.eTouched = true; }
      const s = fm.querySelector('.oo-sum'); if (s) s.innerHTML = sumTxt(o, f);
      if (e.target.name === 'n') { const ei = fm.querySelector('input[name=e]'); if (ei && !f.eTouched) ei.value = String(r2(f.e)).replace('.', ','); }
      const lk = fm.querySelector('[data-oa=fneq]'); if (lk) { const q = eqOf(o, f); lk.hidden = !q || q === f.n; lk.textContent = eqTxt(q); }
    });
    el.addEventListener('submit', e => {
      const fm = e.target.closest('[data-of]'); if (!fm) return; e.preventDefault();
      const id = fm.dataset.of, o = getOrder(id), f = forms.get(id); if (!o || !f) return;
      if (f.mode === 'dlv' && !f.answered) { const q = fm.querySelector('.oo-q.ask'); if (q) { q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake'); } return toast('Prima scegli se è pagato: "Non pagato", Contanti, Satispay o PayPal'); }
      const euro = f.m ? r2(f.e) : 0;
      if (!f.n && !(euro > 0)) return toast('Niente da registrare');
      forms.delete(id);
      run({ action: 'move', id, litri: f.n, euro, metodo: f.m || '' }, 'Registrato');
    });
  }

  /** Riquadro olio disponibile + "Olio dato a mano" con storico */
  function stock(el, post, reload, opt) {
    opt = opt || {};
    addCss();
    const toast = t => (window.toast ? window.toast(t) : alert(t));
    let hm = '', F = [], FSIG = '';
    const elM = opt.mano || el;
    const box = h => `<div class="os oo" style="border:0;padding:0;background:none">${h}</div>`;
    const mano = `<details class="oo-adv" data-os="mano"><summary>🤝 Olio dato a mano ▾</summary><div>
        <form data-of="mano">
          <div class="rw"><input name="nome" placeholder="A chi l'hai dato" maxlength="60" style="flex:1 1 160px" aria-label="A chi l'hai dato" required></div>
          <div class="rw" data-fq></div>
          <div class="rw"><input name="euro" inputmode="decimal" placeholder="Prezzo €" aria-label="Prezzo" style="width:110px"><span class="hint" data-pz></span></div>
          <div class="rw"><span class="hint">Pagato?</span><div class="oo-m">
            <button type="button" data-hm="" class="on">Non ancora</button>
            <button type="button" data-hm="contanti">${MET.contanti}</button>
            <button type="button" data-hm="satispay">${MET.satispay}</button>
            <button type="button" data-hm="paypal">${MET.paypal}</button></div></div>
          <div class="rw"><button class="ob pr">Registra</button><span class="hint">Risulta già consegnato. Lo trovi tra gli ordini con 🤝 A mano.</span></div>
        </form></div></details>
      <details class="oo-adv" data-os="mh" hidden><summary>📋 Storico olio dato a mano <span data-mh-n></span> ▾</summary><div><div class="mh-s" data-mh-s></div><div class="mh-l" data-mh></div></div></details>`;
    // la parte "A mano" si disegna una volta sola (non si perde quello che stai scrivendo quando la pagina si aggiorna)
    if (elM !== el) elM.innerHTML = box(mano);
    let first = true;
    const draw = D => {
      const v = D.available || 0;
      F = (D.formati || (D.settings && D.settings.formati) || []);
      const nums = `<div class="os-n one"><div><small>🫒 Olio disponibile<br>(si prenota sul sito)</small><b data-n="v" class="${v < 0 ? 'neg' : ''}">${lt(v)}</b></div></div>`;
      if (first) { el.innerHTML = box(nums + (elM === el ? mano : '')); first = false; }
      else { const bv = el.querySelector('[data-n=v]'); bv.textContent = lt(v); bv.classList.toggle('neg', v < 0); }
      const fq = elM.querySelector('[data-fq]'), sig = JSON.stringify(F);
      if (fq && sig !== FSIG) {   // caselle dei formati: si ridisegnano solo se i formati cambiano (tiene i numeri già scritti)
        const old = {}; fq.querySelectorAll('[data-fid]').forEach(i => old[i.dataset.fid] = i.value); FSIG = sig;
        const max = Math.max(...F.map(f => f.lt), 1);
        fq.innerHTML = F.map(f => { const nm = (f.tipo === 'bottiglia' ? 'Bottiglie' : 'Lattine') + ' da ' + lt(f.lt);
          return `<label class="hint" style="display:flex;gap:6px;align-items:center">${ico(f, max, 30)}${nm}${f.on && f.prezzo > 0 ? '' : ' <small>(non in vendita)</small>'} <input data-fid="${esc(f.id)}" type="number" inputmode="numeric" min="0" value="${esc(old[f.id] || 0)}" aria-label="${nm}"></label>`; }).join('') || '<span class="hint">Prima crea i formati nel report (💶 Formati e prezzi).</span>';
      }
      const hb = elM.querySelector('[data-os=mh]'); if (!hb) return;
      const M = (D.orders || []).filter(o => o.mano && !o.eliminato).sort((x, y) => y.data.localeCompare(x.data));
      hb.hidden = !D.orders; elM.querySelector('[data-os=mano]').hidden = !D.orders;
      const inc = M.reduce((t, o) => t + paid(o), 0), dap = M.reduce((t, o) => t + rest(o), 0);
      hb.querySelector('[data-mh-n]').textContent = M.length ? `(${M.length})` : '';
      hb.querySelector('[data-mh-s]').innerHTML = M.length ? `<span>🫒 <b>${lt(M.reduce((t, o) => t + o.litri, 0))}</b></span><span>💶 incassati <b>${eur(inc)}</b></span>${dap > 0.005 ? `<span class="r">da avere <b>${eur(dap)}</b></span>` : ''}` : '';
      hb.querySelector('[data-mh]').innerHTML = M.map(o => `<div class="mh-r"><span class="d">${dIt(o.data)}</span><b>${esc(o.nome)} ${esc(o.cognome || '')}</b><span>${latt(o)}</span><span>${eur(o.euro)}</span>${rest(o) > 0.005
        ? `<span class="r">da avere ${eur(rest(o))}</span>` : `<span class="ok">✓ ${usedM(o).map(m => ({ contanti: 'contanti', satispay: 'Satispay', paypal: 'PayPal' })[m] || '').join(' + ') || 'pagato'}</span>`}</div>`).join('') || "<p class=\"hint\">Ancora niente olio dato a mano.</p>";
    };
    const qOf = f => { const o = {}; f.querySelectorAll('[data-fid]').forEach(i => { const v = Math.max(0, parseInt(i.value, 10) || 0); if (v) o[i.dataset.fid] = v; }); return o; };
    const sumOf = (Q, k) => r2(F.reduce((t, f) => t + (Q[f.id] || 0) * f[k], 0));
    [...new Set([el, elM])].forEach(c => {
      c.addEventListener('input', e => { const f = e.target.form; if (f && f.dataset.of === 'mano') { const Q = qOf(f), p = sumOf(Q, 'prezzo'), l = sumOf(Q, 'lt'); f.querySelector('[data-pz]').textContent = l ? lt(l) + (p ? ' · automatico: ' + eur(p) : '') : ''; f.euro.placeholder = l && p ? String(p).replace('.', ',') + ' €' : 'Prezzo €'; } });
      c.addEventListener('click', e => {
        const m = e.target.closest('[data-hm]');
        if (m) { hm = m.dataset.hm; m.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === m)); }
      });
      c.addEventListener('submit', async e => {
        const f = e.target; if (!f.dataset || f.dataset.of !== 'mano') return;
        e.preventDefault();
        const Q = qOf(f), nome = f.nome.value.trim();
        if (!nome) return toast("Scrivi a chi hai dato l'olio"); if (!Object.keys(Q).length) return toast('Scrivi quante lattine o bottiglie');
        const btn = f.querySelector('.ob.pr'); btn.disabled = true;
        try { const j = await post({ action: 'handOrder', nome, pezzi: Q, euro: f.euro.value.trim(), metodo: hm });
          if (!j.ok) throw new Error(j.error);
          toast(`${nome}: ${lt(sumOf(Q, 'lt'))} dati a mano ✓`); f.reset(); hm = ''; f.querySelectorAll('[data-hm]').forEach(x => x.classList.toggle('on', x.dataset.hm === '')); f.querySelector('[data-pz]').textContent = ''; f.euro.placeholder = 'Prezzo €'; await reload(); }
        catch (x) { toast(x.message || 'Non salvato'); } finally { btn.disabled = false; }
      });
    });
    return { update: draw };
  }

  window.OliOrd = { row, bind, paid, rest, cons, left, done, eur, lt, latt, ico, stock, mini };
})();
