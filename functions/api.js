/**
 * OliAmo – motore su Cloudflare (Pages Function + database D1)
 * Indirizzo: /api   (GET ?action=info|report|area, POST con JSON)
 * Quantità sempre in LITRI. Lattine da 3 lt (q3) e da 5 lt (q5); i prezzi si impostano dal report (impostazioni p3 / p5).
 * Segreti da impostare in Cloudflare (Settings > Variables and Secrets):
 *   MASTER_KEY      = password iniziale del report (finché non la cambi dal report; poi vale quella cifrata nel database)
 *   TELEGRAM_TOKEN  = token del bot Telegram per gli avvisi (facoltativo)
 * La chat Telegram a cui scrivere si collega dal report (azione 'tgLink'): scrivi al bot, poi collega.
 */

const SITE = 'https://oliamo.boneggio.it';
const SATISPAY_PHONE = '+393931609967';
const PAYPAL_ME = 'https://paypal.me/bartoccifrancesco';   // link PayPal.Me per i pagamenti
const paypalLink = euro => PAYPAL_ME + '/' + (+euro || 0).toFixed(2) + 'EUR';
const TZ = 'Europe/Rome';
const L3 = 3, L5 = 5;    // litri delle due lattine
const DEFAULT_MSG = "Al momento l'olio è finito. Appena ne abbiamo altro vi avviseremo. Grazie!";
const NOPRICE_MSG = 'Le prenotazioni apriranno a breve: stiamo preparando i prezzi.';
const TRASH_DAYS = 30;   // dopo quanti giorni il cestino si svuota da solo

/* ---------- utilità ---------- */

const json = o => new Response(JSON.stringify(o), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
});
const romeParts = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const now_ = () => romeParts().slice(0, 16);          // yyyy-MM-dd HH:mm
const today_ = () => romeParts().slice(0, 10);        // yyyy-MM-dd
const newId = p => p + crypto.randomUUID().replace(/-/g, '').slice(0, 9);
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dIt = ymd => new Date(ymd + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

// litri disponibili = caricati − CONSEGNATI (le prenotazioni non ancora consegnate non li toccano; il cestino non conta)
const GIVEN = "(SELECT COALESCE(SUM(p.litri),0) FROM payments p JOIN orders o ON o.id = p.order_id WHERE COALESCE(o.eliminato,'') = '')";
const LOADED = '(SELECT COALESCE(SUM(litri),0) FROM loads)';
const AV = `(${LOADED} - ${GIVEN})`;
const all = async (db, sql, ...b) => (await db.prepare(sql).bind(...b).all()).results;
const lt = n => (+n || 0) + ' lt';
const lattTxt = (q3, q5) => [q3 ? q3 + (q3 === 1 ? ' lattina' : ' lattine') + ' da 3 lt' : '', q5 ? q5 + (q5 === 1 ? ' lattina' : ' lattine') + ' da 5 lt' : ''].filter(Boolean).join(' + ');
const eurTxt = e => (+e || 0).toFixed(2).replace('.', ',') + ' €';

/* ---------- dati ---------- */

const orders_ = async db => {
  const pays = {};
  (await all(db, 'SELECT id, order_id, data, euro, litri, metodo, utente FROM payments ORDER BY data, ins')).forEach(p => (pays[p.order_id] = pays[p.order_id] || []).push({ id: p.id, data: p.data, euro: p.euro, litri: p.litri || 0, metodo: p.metodo || '', utente: p.utente || '' }));
  return (await all(db, 'SELECT * FROM orders ORDER BY data')).map(r => {
    const payments = pays[r.id] || [];
    return {
      id: r.id, data: r.data, nome: r.nome, cognome: r.cognome || '', telefono: r.telefono || '',
      q3: r.q3 || 0, q5: r.q5 || 0, litri: r.litri, euro: r.euro, note: r.note || '',
      pagato: !!r.pagato, consegnato: !!r.consegnato, dataPag: r.data_pag || '', metodo: r.metodo || '', perIl: r.per_il || '',
      stato: r.stato || 'ok', eliminato: r.eliminato || '', mano: !!r.mano,
      payments, paid: Math.round(payments.reduce((t, p) => t + p.euro, 0) * 100) / 100,
      consegnati: Math.min(r.litri, payments.reduce((t, p) => t + p.litri, 0))
    };
  });
};
/** vendite per il grafico: un elemento per ogni pagamento (litri in proporzione all'importo) */
const sales_ = ord => ord.filter(o => !o.eliminato).flatMap(o => o.payments.filter(p => p.euro > 0).map(p => ({ data: p.data, euro: p.euro, litri: o.euro ? Math.round(o.litri * p.euro / o.euro * 10) / 10 : 0 })));
const loads_ = db => all(db, 'SELECT id, data, litri, utente, note, ins FROM loads ORDER BY data, ins');
const costs_ = db => all(db, 'SELECT id, data, descr, euro, utente, ins, qta, unita FROM costs ORDER BY data, ins');
const users_ = db => all(db, 'SELECT tk, nome, ruolo, creato FROM users ORDER BY creato, nome');
async function userByToken(db, tk) {
  tk = String(tk || '');
  return tk.length >= 10 ? await db.prepare('SELECT tk, nome, ruolo FROM users WHERE tk = ?').bind(tk).first() : null;
}
async function available_(db) {
  const r = await db.prepare(`SELECT ${AV} AS n`).first();
  return Math.max(0, r.n || 0);
}
const price_ = v => { const n = Math.round((parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0) * 100) / 100; return n > 0 && n < 10000 ? n : 0; };
async function settings_(db) {
  const s = {}; (await all(db, "SELECT k, v FROM settings WHERE k IN ('open','msg','p3','p5')")).forEach(r => s[r.k] = r.v);
  return { open: s.open !== '0', msg: s.msg || '', p3: price_(s.p3), p5: price_(s.p5) };
}
const priceOf = (s, q3, q5) => Math.round((q3 * s.p3 + q5 * s.p5) * 100) / 100;

/* ---------- avvisi (Telegram) ---------- */

const tgApi = (env, method, body) => fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/' + method, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(r => r.json());

async function telegram(env, db, text, buttons) {
  if (!env.TELEGRAM_TOKEN) return false;
  const c = await db.prepare("SELECT v FROM settings WHERE k = 'tg_chat'").first();
  if (!c || !c.v) return false;
  const extra = buttons && buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {};
  try {
    let r = await tgApi(env, 'sendMessage', { chat_id: c.v, text, disable_web_page_preview: true, ...extra });
    const nuovo = r.parameters && r.parameters.migrate_to_chat_id;   // il gruppo è diventato "supergruppo": nuovo id
    if (!r.ok && nuovo) {
      await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('tg_chat', ?)").bind(String(nuovo)).run();
      r = await tgApi(env, 'sendMessage', { chat_id: nuovo, text, disable_web_page_preview: true, ...extra });
    }
    return r.ok;
  }
  catch (err) { return false; }
}

/* ---------- accesso del gestore: password cifrata, codice a 6 cifre (TOTP), sessioni ---------- */

const SESSION_DAYS = 30, SESSION_HOURS_SHORT = 12, PBKDF2_ITER = 10000, MAX_FAIL = 5, MAX_FAIL_ALL = 30, LOCK_MIN = 15;
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async t => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
const same = (a, b) => { a = String(a); b = String(b); let r = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; };
const getS = async (db, k) => { const r = await db.prepare('SELECT v FROM settings WHERE k = ?').bind(k).first(); return r ? r.v : ''; };
const setS = (db, k, v) => v === null ? db.prepare('DELETE FROM settings WHERE k = ?').bind(k).run() : db.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind(k, String(v)).run();

async function pbkdf2(pw, salt, it = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, key, 256));
}
async function hashPw(pw) { const salt = rnd(16); return b64(salt) + ':' + await pbkdf2(pw, salt) + ':' + PBKDF2_ITER; }
/** La password è quella cambiata dal report (salvata cifrata); se non è mai stata cambiata vale il segreto MASTER_KEY */
async function checkPw(db, env, pw) {
  pw = String(pw || ''); if (!pw) return false;
  const h = await getS(db, 'pw_hash');
  if (h) { const [salt, hash, it] = h.split(':'); return same(await pbkdf2(pw, unb64(salt), +it || PBKDF2_ITER), hash); }
  return !!env.MASTER_KEY && same(pw, env.MASTER_KEY);
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = bytes => { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; };
const b32dec = s => { let bits = 0, val = 0; const out = []; for (const c of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); };
async function totp(secret, step) {
  const key = await crypto.subtle.importKey('raw', b32dec(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8); new DataView(msg).setUint32(4, step);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg)), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
/** Verifica un codice a 6 cifre (accetta 30 secondi prima/dopo; ogni codice vale una volta sola) */
async function checkTotp(db, secret, code) {
  code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return false;
  const now = Math.floor(Date.now() / 30000), last = +(await getS(db, 'tfa_last')) || 0;
  for (const st of [now - 1, now, now + 1]) if (st > last && same(await totp(secret, st), code)) { await setS(db, 'tfa_last', st); return true; }
  return false;
}
/** Codici di emergenza (se perdi il telefono): ognuno vale una volta */
async function useRecovery(db, code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B'); if (c.length !== 10) return false;
  const L = JSON.parse(await getS(db, 'tfa_recovery') || '[]'), h = await sha256(c), i = L.indexOf(h);
  if (i < 0) return false;
  L.splice(i, 1); await setS(db, 'tfa_recovery', JSON.stringify(L)); return true;
}
/** Controlla un codice di emergenza senza consumarlo */
async function hasRecovery(db, code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B'); if (c.length !== 10) return false;
  return JSON.parse(await getS(db, 'tfa_recovery') || '[]').includes(await sha256(c));
}
async function checkSecond(db, code) {
  const sec = await getS(db, 'tfa_secret');
  if (!sec) return true;
  return await checkTotp(db, sec, code) || await useRecovery(db, code);
}

async function newSession(db, long) {
  const tok = b64(rnd(32)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
  const exp = Date.now() + (long ? SESSION_DAYS * 864e5 : SESSION_HOURS_SHORT * 36e5);
  await db.prepare('DELETE FROM sessions WHERE exp < ?').bind(Date.now()).run();
  await db.prepare('INSERT INTO sessions (h, creato, exp) VALUES (?, ?, ?)').bind(await sha256(tok), now_(), exp).run();
  return tok;
}
async function isMaster(db, request, d) {
  const tok = (request.headers.get('X-Ovi-Session') || (d && d.s) || '').trim();
  if (tok.length < 20) return false;
  const r = await db.prepare('SELECT exp FROM sessions WHERE h = ?').bind(await sha256(tok)).first();
  return !!r && r.exp > Date.now();
}

/** Limite ai tentativi sbagliati: 5 per indirizzo IP e 30 in tutto, negli ultimi 15 minuti */
const ipOf = request => (request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'x').split(',')[0].trim().slice(0, 64);
async function limiter(db, env, request) {
  const keys = ['lf:' + ipOf(request), 'lf:*'], now = Date.now(), win = LOCK_MIN * 6e4;
  const st = await Promise.all(keys.map(async k => { const v = JSON.parse(await getS(db, k) || 'null'); return v && now - v.t0 < win ? v : { n: 0, t0: now }; }));
  const locked = () => st[0].n >= MAX_FAIL || st[1].n >= MAX_FAIL_ALL;
  const left = () => Math.max(1, Math.ceil((Math.max(st[0].n >= MAX_FAIL ? st[0].t0 : 0, st[1].n >= MAX_FAIL_ALL ? st[1].t0 : 0) + win - now) / 6e4));
  return {
    locked, blockedMsg: () => 'Troppi tentativi sbagliati: riprova tra ' + left() + ' minuti.',
    async fail() {
      const was = locked();
      st.forEach(v => v.n++);
      await Promise.all(keys.map((k, i) => setS(db, k, JSON.stringify(st[i]))));
      if (!was && locked()) await telegram(env, db, '⚠️ OliAmo – troppi tentativi sbagliati di accesso al report (indirizzo ' + ipOf(request) + '): bloccato per ' + LOCK_MIN + ' minuti.');
      await new Promise(r => setTimeout(r, 800));   // rallenta i tentativi a raffica
    },
    ok: () => setS(db, keys[0], null)
  };
}

async function login_(db, env, request, d) {
  const lim = await limiter(db, env, request);
  if (lim.locked()) return json({ ok: false, error: lim.blockedMsg() });
  const fail = async msg => { await lim.fail(); return json({ ok: false, error: lim.locked() ? lim.blockedMsg() : msg }); };
  if (!await checkPw(db, env, d.password)) return await fail('Password errata');
  const tfa = !!(await getS(db, 'tfa_secret'));
  if (tfa && !String(d.code || '').trim()) return json({ ok: false, need2fa: true });
  if (tfa && !await checkSecond(db, d.code)) return await fail('Codice errato');
  await lim.ok();
  const s = await newSession(db, !!d.remember);
  await telegram(env, db, '🔐 OliAmo – accesso al report' + (d.remember ? ' (dispositivo ricordato 30 giorni)' : '') + '.\nSe non sei stato tu, cambia subito la password.');
  return json({ ok: true, s, tfa });
}

/** Password dimenticata: servono un codice di emergenza E il codice a 6 cifre dell'app (tutti e due) */
async function pwReset_(db, env, request, d) {
  const lim = await limiter(db, env, request);
  if (lim.locked()) return json({ ok: false, error: lim.blockedMsg() });
  const sec = await getS(db, 'tfa_secret');
  if (!sec) return json({ ok: false, error: 'Il recupero funziona solo con la verifica in due passaggi attiva.' });
  const pw = String(d.new || '');
  if (pw.length < 10) return json({ ok: false, error: 'La nuova password deve avere almeno 10 caratteri' });
  const fail = async () => { await lim.fail(); return json({ ok: false, error: lim.locked() ? lim.blockedMsg() : 'Codice di emergenza o codice a 6 cifre non validi' }); };
  if (!await hasRecovery(db, d.recovery)) return await fail();
  if (!await checkTotp(db, sec, d.code)) return await fail();
  if (!await useRecovery(db, d.recovery)) return await fail();
  await lim.ok();
  await setS(db, 'pw_hash', await hashPw(pw));
  await db.prepare('DELETE FROM sessions').run();     // chiude l'accesso su tutti gli altri dispositivi
  const left = JSON.parse(await getS(db, 'tfa_recovery') || '[]').length;
  await telegram(env, db, '🔐 OliAmo – la password del report è stata reimpostata con un codice di emergenza (ne restano ' + left + ').\nSe non sei stato tu, avvisa subito chi gestisce il sito.');
  return json({ ok: true, s: await newSession(db, !!d.remember), left });
}

async function security_(db, env, request, d) {
  if (!['secInfo', 'logout', 'logoutAll', 'pwChange', 'tfaStart', 'tfaConfirm', 'tfaOff', 'tfaNewCodes'].includes(d.action)) return null;
  const tfa = !!(await getS(db, 'tfa_secret'));
  const lim = await limiter(db, env, request);
  if (['pwChange', 'tfaConfirm', 'tfaOff', 'tfaNewCodes'].includes(d.action) && lim.locked()) return json({ ok: false, error: lim.blockedMsg() });
  const bad = async msg => { await lim.fail(); return json({ ok: false, error: lim.locked() ? lim.blockedMsg() : msg }); };
  switch (d.action) {
    case 'secInfo':
      return json({ ok: true, tfa, recovery: JSON.parse(await getS(db, 'tfa_recovery') || '[]').length, custom: !!(await getS(db, 'pw_hash')) });
    case 'logout': {
      const tok = request.headers.get('X-Ovi-Session') || d.s || '';
      await db.prepare('DELETE FROM sessions WHERE h = ?').bind(await sha256(tok)).run();
      return json({ ok: true });
    }
    case 'logoutAll': {
      await db.prepare('DELETE FROM sessions').run();
      await telegram(env, db, '🔐 OliAmo – chiuse le sessioni del report su tutti i dispositivi.');
      return json({ ok: true });
    }
    case 'pwChange': {
      const pw = String(d.new || '');
      if (pw.length < 10) return json({ ok: false, error: 'La nuova password deve avere almeno 10 caratteri' });
      if (!await checkPw(db, env, d.old)) return await bad('La password attuale non è giusta');
      if (tfa && !await checkSecond(db, d.code)) return await bad('Codice a 6 cifre errato');
      await setS(db, 'pw_hash', await hashPw(pw));
      await db.prepare('DELETE FROM sessions').run();     // esci da tutti gli altri dispositivi
      await telegram(env, db, '🔐 OliAmo – la password del report è stata cambiata.');
      return json({ ok: true, s: await newSession(db, !!d.remember) });
    }
    case 'tfaStart': {
      if (tfa) return json({ ok: false, error: 'La verifica in due passaggi è già attiva' });
      const sec = b32enc(rnd(20));
      await setS(db, 'tfa_pending', sec);
      return json({ ok: true, secret: sec, uri: 'otpauth://totp/OliAmo:report?secret=' + sec + '&issuer=OliAmo&digits=6&period=30' });
    }
    case 'tfaConfirm': {
      const sec = await getS(db, 'tfa_pending');
      if (!sec) return json({ ok: false, error: 'Ricomincia l\'attivazione' });
      if (!await checkTotp(db, sec, d.code)) return await bad('Codice errato: controlla l\'ora del telefono e riprova');
      const codes = [...Array(8)].map(() => b32enc(rnd(7)).slice(0, 10));
      await setS(db, 'tfa_recovery', JSON.stringify(await Promise.all(codes.map(sha256))));
      await setS(db, 'tfa_secret', sec); await setS(db, 'tfa_pending', null);
      await telegram(env, db, '🔐 OliAmo – verifica in due passaggi attivata per il report.');
      return json({ ok: true, recovery: codes.map(c => c.slice(0, 5) + '-' + c.slice(5)) });
    }
    case 'tfaNewCodes': {   // nuovi codici di emergenza: quelli vecchi smettono di valere
      if (!tfa) return json({ ok: false, error: 'La verifica in due passaggi non è attiva' });
      if (!await checkPw(db, env, d.password)) return await bad('Password errata');
      if (!await checkSecond(db, d.code)) return await bad('Codice errato');
      const codes = [...Array(8)].map(() => b32enc(rnd(7)).slice(0, 10));
      await setS(db, 'tfa_recovery', JSON.stringify(await Promise.all(codes.map(sha256))));
      await telegram(env, db, '🔐 OliAmo – generati nuovi codici di emergenza per il report (quelli vecchi non valgono più).');
      return json({ ok: true, recovery: codes.map(c => c.slice(0, 5) + '-' + c.slice(5)) });
    }
    case 'tfaOff': {
      if (!await checkPw(db, env, d.password)) return await bad('Password errata');
      if (!await checkSecond(db, d.code)) return await bad('Codice errato');
      await setS(db, 'tfa_secret', null); await setS(db, 'tfa_recovery', null);
      await telegram(env, db, '⚠️ OliAmo – verifica in due passaggi DISATTIVATA per il report.');
      return json({ ok: true });
    }
  }
  return null;
}

/** Pulizia del cestino (al massimo una volta l'ora) */
async function tidy_(db) {
  const now = Date.now(), last = await db.prepare("SELECT v FROM settings WHERE k = 'last_tidy'").first();
  if (last && now - (+last.v || 0) < 3600e3) return;
  await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('last_tidy', ?)").bind(String(now)).run();
  await purge_(db, "eliminato <> '' AND eliminato < ?", addDays(today_(), -TRASH_DAYS));
}

/** Collega la chat: prende l'ultima persona che ha scritto al bot e le manda una conferma */
async function tgLink_(db, env) {
  if (!env.TELEGRAM_TOKEN) return json({ ok: false, error: 'Manca il segreto TELEGRAM_TOKEN su Cloudflare' });
  const up = await tgApi(env, 'getUpdates', { limit: 100 });
  if (!up.ok) return json({ ok: false, error: 'Telegram: ' + (up.description || 'token non valido') });
  const msgs = (up.result || []).map(u => u.message || u.edited_message || u.my_chat_member).filter(m => m && m.chat && !(m.new_chat_member && m.new_chat_member.status === 'left'));
  if (!msgs.length) return json({ ok: false, error: 'Scrivi prima un messaggio al bot su Telegram (es. "ciao"), poi riprova.' });
  const chat = msgs[msgs.length - 1].chat;
  await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('tg_chat', ?)").bind(String(chat.id)).run();
  const sent = await tgApi(env, 'sendMessage', { chat_id: chat.id, text: '🫒 OliAmo collegato! ' + (chat.type === 'private' ? 'Qui riceverai' : 'In questo gruppo arriverà') + ' un messaggio per ogni nuova prenotazione di olio.' });
  return json({ ok: !!sent.ok, chat: chat.first_name || chat.title || '', error: sent.ok ? undefined : sent.description });
}

/* ---------- GET ---------- */

export async function onRequestGet({ request, env, waitUntil }) {
  const db = env.DB, p = Object.fromEntries(new URL(request.url).searchParams);
  waitUntil(tidy_(db).catch(() => {}));
  if (p.action === 'info') {
    const s = await settings_(db), left = await available_(db), priced = s.p3 > 0 && s.p5 > 0;
    return json({ ok: true, open: s.open && priced && left > 0, closedByHand: !s.open || !priced, available: left,
      msg: !priced ? NOPRICE_MSG : (s.msg || DEFAULT_MSG), p3: s.p3, p5: s.p5, minData: addDays(today_(), 1) });
  }
  if (p.action === 'report') {
    if (!await isMaster(db, request, null)) return json({ ok: false, auth: true, error: 'Accesso scaduto: entra di nuovo' });
    const [orders, loads, costs, users, settings, available] = await Promise.all([orders_(db), loads_(db), costs_(db), users_(db), settings_(db), available_(db)]);
    return json({ ok: true, orders, loads, costs, users, settings, available, sales: sales_(orders) });
  }
  if (p.action === 'area') {
    const u = await userByToken(db, p.t);
    if (!u) return json({ ok: false, error: 'Link non valido. Chiedi un nuovo link a chi gestisce OliAmo.' });
    const s = await settings_(db);
    const out = { ok: true, nome: u.nome, ruolo: u.ruolo, available: await available_(db), p3: s.p3, p5: s.p5 };
    const loads = await loads_(db);
    if (u.ruolo === 'intermedio') {
      out.loads = loads; out.costs = await costs_(db);
      const ord = (await orders_(db)).filter(o => !o.eliminato);
      out.orders = ord;
      out.sales = sales_(ord);
    } else {
      out.loads = loads.filter(l => l.utente === u.nome);
    }
    return json(out);
  }
  return json({ ok: true, service: 'oliamo' });
}

/* ---------- POST ---------- */

export async function onRequestPost({ request, env, waitUntil }) {
  const db = env.DB;
  try {
    const d = JSON.parse(await request.text() || '{}');
    if (!d.action) return await order_(db, env, d);
    if (d.action === 'login') return await login_(db, env, request, d);
    if (d.action === 'pwReset') return await pwReset_(db, env, request, d);

    const master = await isMaster(db, request, d);
    if (master) { const r = await security_(db, env, request, d); if (r) return r; }
    const u = master ? { nome: 'Master', ruolo: 'master' } : await userByToken(db, d.t);
    if (!u) return json({ ok: false, auth: true, error: 'Accesso non valido' });
    const canCost = master || u.ruolo === 'intermedio';

    switch (d.action) {
      case 'load': return await addLoad_(db, d, u);
      case 'delLoad': return await delEntry_(db, 'loads', d.id, u, master);
      case 'handOrder': if (!canCost) break; return await handOrder_(db, d, u);
      case 'cost': if (!canCost) break; return await addCost_(db, d, u);
      case 'delCost': if (!canCost) break; return await delEntry_(db, 'costs', d.id, u, master);
      case 'flag': if (!canCost) break; return await flag_(db, d, u);
      case 'move': if (!canCost) break; return await move_(db, d, u);
      case 'payDel': if (!canCost) break; return await payDel_(db, d);
      case 'delOrders': if (!canCost) break; return await delOrders_(db, d);   // va nel cestino: si ripristina dal report
    }
    if (!master) return json({ ok: false, error: 'Operazione non consentita' });
    switch (d.action) {
      case 'restore': return await restore_(db, d);
      case 'purge': {
        const ids = (d.ids || []).map(String);
        return json({ ok: true, purged: ids.length ? await purge_(db, `eliminato <> '' AND id IN (${ids.map(() => '?').join(',')})`, ...ids) : 0 });
      }
      case 'settings': return await saveSettings_(db, d);
      case 'userSave': return await userSave_(db, d);
      case 'userDelete': await db.prepare('DELETE FROM users WHERE tk = ?').bind(String(d.tk)).run(); return json({ ok: true, users: await users_(db) });
      case 'tgLink': return await tgLink_(db, env);
      case 'tgTest': return json({ ok: await telegram(env, db, '🫒 OliAmo: messaggio di prova.') });
    }
    return json({ ok: false, error: 'Azione sconosciuta' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

export function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Ovi-Session' } });
}

/** Prenotazione dal sito: "subito" (solo se c'è olio) o "per una data" (promemoria, si può anche a olio finito) */
async function order_(db, env, d) {
  const rid = d.rid ? 'rid:' + String(d.rid).slice(0, 64) : '';
  if (rid) {   // stesso invio ripetuto: restituisco la risposta di prima
    const prev = await db.prepare('SELECT res FROM idem WHERE rid = ?').bind(rid).first();
    if (prev) return json(JSON.parse(prev.res));
  }
  const s = await settings_(db), left = await available_(db);
  if (!(s.p3 > 0 && s.p5 > 0)) return json({ ok: false, closed: true, error: NOPRICE_MSG });
  if (!s.open || (left <= 0 && d.tipo !== 'data')) return json({ ok: false, closed: true, error: s.msg || DEFAULT_MSG });

  const nome = clean(d.nome, 60), cognome = clean(d.cognome, 60);
  if (!nome || !cognome) return json({ ok: false, error: 'Nome e cognome obbligatori' });
  const q3 = Math.max(0, Math.min(50, parseInt(d.q3, 10) || 0));
  const q5 = Math.max(0, Math.min(50, parseInt(d.q5, 10) || 0));
  const litri = q3 * L3 + q5 * L5;
  if (!litri) return json({ ok: false, error: 'Scegli almeno una lattina' });
  if (d.tipo !== 'data' && litri > left) return json({ ok: false, error: 'Sono rimasti solo ' + lt(left) + ' di olio disponibili.' });
  const euro = priceOf(s, q3, q5);
  let perIl = '';
  if (d.tipo === 'data') {   // prenotazione per un giorno scelto (da domani a 3 mesi)
    if (!isDate(d.perIl) || d.perIl < addDays(today_(), 1)) return json({ ok: false, error: 'Scegli una data da domani in poi.' });
    if (d.perIl > addDays(today_(), 90)) return json({ ok: false, error: 'Puoi prenotare al massimo per i prossimi 3 mesi.' });
    perIl = d.perIl;
  }
  const telefono = clean(d.telefono, 30), note = clean(d.note, 500);

  // inserisce solo se l'olio basta ancora (evita di prenotare due volte lo stesso)
  const r = await db.prepare(`INSERT INTO orders (id, data, nome, cognome, telefono, q3, q5, litri, euro, note, per_il)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE ${d.tipo === 'data' ? '1 = 1 OR ' : ''}${AV} >= ?`)
    .bind(newId('p'), now_(), nome, cognome, telefono, q3, q5, litri, euro, note, perIl, litri).run();
  if (!r.meta.changes) {
    const l2 = await available_(db);
    return json({ ok: false, error: l2 > 0 ? 'Sono rimasti solo ' + lt(l2) + ' di olio disponibili.' : (s.msg || DEFAULT_MSG), closed: l2 <= 0 });
  }
  const res = { ok: true, litri, q3, q5, euro, left, satispay: SATISPAY_PHONE, paypal: paypalLink(euro), perIl };
  if (rid) await db.prepare('INSERT OR REPLACE INTO idem (rid, res, ts) VALUES (?, ?, ?)').bind(rid, JSON.stringify(res), Date.now()).run();

  await telegram(env, db, '🫒 OliAmo – nuova prenotazione\n' + nome + ' ' + cognome + ': ' + lattTxt(q3, q5) + ' (' + lt(litri) + ')' +
    ' · ' + eurTxt(euro) +
    (perIl ? '\nPer il: ' + perIl.split('-').reverse().join('/') : '') +
    (telefono ? '\nTel: ' + telefono : '') +
    (note ? '\nNote: ' + note : '') +
    '\nOlio disponibile (non ancora consegnato): ' + lt(left),
    [[{ text: '📋 Apri il report', url: SITE + '/report.html' }]]);
  return json(res);
}

/** Carico di olio (litri). Il master può anche togliere (numero negativo) */
async function addLoad_(db, d, u) {
  const n = parseInt(d.litri, 10) || 0;
  if (!n || (n < 0 && u.ruolo !== 'master')) return json({ ok: false, error: 'Numero di litri non valido' });
  if (Math.abs(n) > 20000) return json({ ok: false, error: 'Numero troppo grande' });
  const data = isDate(d.data) ? d.data : today_(), note = clean(d.note, 200);
  await db.prepare('INSERT INTO loads (id, data, litri, utente, note, ins) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('c'), data, n, u.nome, note, now_()).run();
  return json({ ok: true, available: await available_(db) });
}

/** Olio dato a mano senza prenotazione: già consegnato; pagamento subito o dopo */
async function handOrder_(db, d, u) {
  const nome = clean(d.nome, 60);
  if (!nome) return json({ ok: false, error: "Scrivi a chi hai dato l'olio" });
  let q3 = Math.max(0, Math.min(200, parseInt(d.q3, 10) || 0)), q5 = Math.max(0, Math.min(200, parseInt(d.q5, 10) || 0));
  const litri = q3 * L3 + q5 * L5;
  if (!litri) return json({ ok: false, error: 'Scegli quante lattine' });
  const s = await settings_(db);
  const euro = d.euro === '' || d.euro == null ? priceOf(s, q3, q5) : Math.round((parseFloat(String(d.euro).replace(',', '.')) || 0) * 100) / 100;
  if (!(euro >= 0) || euro > 100000) return json({ ok: false, error: 'Importo non valido' });
  const metodo = ['contanti', 'satispay', 'paypal'].includes(d.metodo) ? d.metodo : '';
  const day = isDate(d.data) ? d.data : today_(), id = newId('p');
  const r = await db.prepare(`INSERT INTO orders (id, data, nome, cognome, telefono, q3, q5, litri, euro, note, per_il, mano)
    SELECT ?, ?, ?, '', ?, ?, ?, ?, ?, ?, '', 1 WHERE ${d.force ? '1' : AV + ' >= ?'}`)
    .bind(...[id, day + now_().slice(10), nome, clean(d.telefono, 30), q3, q5, litri, euro, clean(d.note, 500)].concat(d.force ? [] : [litri])).run();
  if (!r.meta.changes) { const av = await available_(db); return json({ ok: false, short: true, need: litri, available: av, error: 'Ci sono solo ' + lt(av) + ' di olio disponibili.' }); }
  await addMove_(db, id, day, litri, metodo ? euro : 0, metodo, u);
  await sync_(db, id);
  return json({ ok: true, available: await available_(db) });
}

async function addCost_(db, d, u) {
  const imp = Math.round((parseFloat(String(d.importo).replace(',', '.')) || 0) * 100) / 100;
  const descr = clean(d.descr, 120);
  if (!imp || imp < 0) return json({ ok: false, error: 'Importo non valido' });
  if (!descr) return json({ ok: false, error: 'Scrivi una descrizione (es. frantoio, lattine, raccolta)' });
  const data = isDate(d.data) ? d.data : today_();
  const qta = Math.round((parseFloat(String(d.qta || '').replace(',', '.')) || 0) * 1000) / 1000;
  if (qta < 0 || qta > 100000) return json({ ok: false, error: 'Quantità non valida' });
  const unita = qta ? (['kg', 'pz', 'l', 'h'].indexOf(d.unita) >= 0 ? d.unita : 'kg') : '';
  await db.prepare('INSERT INTO costs (id, data, descr, euro, utente, ins, qta, unita) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('k'), data, descr, imp, u.nome, now_(), qta, unita).run();
  return json({ ok: true });
}

/** Cancella un carico o un costo: il master tutto, gli altri solo quello che hanno inserito loro */
async function delEntry_(db, table, id, u, master) {
  if (!master) {
    const it = await db.prepare(`SELECT utente FROM ${table} WHERE id = ?`).bind(String(id)).first();
    if (!it || it.utente !== u.nome) return json({ ok: false, error: 'Puoi cancellare solo quello che hai inserito tu' });
  }
  const r = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(String(id)).run();
  return json({ ok: r.meta.changes > 0, available: await available_(db) });
}

/** Ricalcola pagato / consegnato / metodo / data_pag / consegnati di un ordine dai suoi movimenti (tabella payments) */
async function sync_(db, id) {
  const o = await db.prepare('SELECT euro, litri FROM orders WHERE id = ?').bind(id).first();
  if (!o) return;
  const P = await all(db, 'SELECT data, euro, litri, metodo FROM payments WHERE order_id = ? ORDER BY data, ins', id);
  const M = P.filter(p => p.euro > 0), paid = M.reduce((t, p) => t + p.euro, 0), dl = P.reduce((t, p) => t + (p.litri || 0), 0);
  const met = [...new Set(M.map(p => p.metodo || ''))];
  await db.prepare('UPDATE orders SET pagato = ?, data_pag = ?, metodo = ?, consegnati = ?, consegnato = ? WHERE id = ?')
    .bind(paid >= o.euro - 0.005 ? 1 : 0, M.length ? M[M.length - 1].data : '', met.length === 1 ? met[0] : met.length ? 'misto' : '',
      Math.min(dl, o.litri), dl >= o.litri ? 1 : 0, id).run();
}
/** Quanto manca da avere e quanti litri da dare */
const remaining_ = async (db, id) => {
  const r = await db.prepare(`SELECT euro - COALESCE((SELECT SUM(euro) FROM payments WHERE order_id = orders.id), 0) AS e,
    litri - COALESCE((SELECT SUM(litri) FROM payments WHERE order_id = orders.id), 0) AS u FROM orders WHERE id = ?`).bind(id).first();
  return r ? { e: Math.max(0, Math.round(r.e * 100) / 100), u: Math.max(0, r.u) } : null;
};
const addMove_ = (db, id, data, litri, euro, metodo, u) => db.prepare('INSERT INTO payments (id, order_id, data, euro, litri, metodo, utente, ins) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .bind(newId('m'), id, data, euro, litri, euro > 0 ? (['satispay', 'paypal'].includes(metodo) ? metodo : 'contanti') : '', u.nome, now_()).run();

/** Tutto pagato / niente pagato, tutto consegnato / niente consegnato */
async function flag_(db, d, u) {
  const field = d.field === 'pagato' ? 'pagato' : d.field === 'consegnato' ? 'consegnato' : '';
  if (!field) return json({ ok: false, error: 'Campo non valido' });
  const ids = (d.ids || []).map(String), on = d.value === true;
  let n = 0;
  for (const id of ids) {
    const rest = await remaining_(db, id);
    if (!rest) continue;
    if (on) {
      if (field === 'pagato' && rest.e > 0.005) await addMove_(db, id, today_(), 0, rest.e, d.metodo, u);
      if (field === 'consegnato' && rest.u > 0) await addMove_(db, id, today_(), rest.u, 0, '', u);
    } else {
      await db.prepare(field === 'pagato' ? "UPDATE payments SET euro = 0, metodo = '' WHERE order_id = ?" : 'UPDATE payments SET litri = 0 WHERE order_id = ?').bind(id).run();
      await db.prepare('DELETE FROM payments WHERE order_id = ? AND euro <= 0 AND COALESCE(litri,0) <= 0').bind(id).run();
    }
    await sync_(db, id); n++;
  }
  return json({ ok: true, updated: n });
}

/** Un movimento: litri consegnati adesso (d.litri) e/o soldi ricevuti adesso (d.euro, d.metodo). Anche in anticipo o in parte. */
async function move_(db, d, u) {
  const id = String(d.id || ''), rest = await remaining_(db, id);
  if (!rest) return json({ ok: false, error: 'Prenotazione non trovata' });
  const n = Math.max(0, parseInt(d.litri, 10) || 0);
  const e = Math.round((parseFloat(String(d.euro == null ? '' : d.euro).replace(',', '.')) || 0) * 100) / 100;
  if (!n && !(e > 0)) return json({ ok: false, error: "Scrivi i litri consegnati o l'importo pagato" });
  if (n > rest.u) return json({ ok: false, error: rest.u ? 'Restano da dare solo ' + lt(rest.u) : "L'olio è già tutto consegnato" });
  if (e < 0 || e > rest.e + 0.005) return json({ ok: false, error: rest.e > 0 ? 'Restano da avere solo ' + eurTxt(rest.e) : 'È già tutto pagato' });
  if (e > 0 && !['contanti', 'satispay', 'paypal'].includes(d.metodo)) return json({ ok: false, error: 'Scegli Contanti, Satispay o PayPal' });
  await addMove_(db, id, isDate(d.data) ? d.data : today_(), n, e, d.metodo, u);
  await sync_(db, id);
  return json({ ok: true });
}
async function payDel_(db, d) {
  const p = await db.prepare('SELECT order_id FROM payments WHERE id = ?').bind(String(d.pid || '')).first();
  if (!p) return json({ ok: false, error: 'Movimento non trovato' });
  await db.prepare('DELETE FROM payments WHERE id = ?').bind(String(d.pid)).run();
  await sync_(db, p.order_id);
  return json({ ok: true });
}

/** "Elimina" sposta nel cestino: l'olio torna disponibile, ma si può ripristinare */
async function delOrders_(db, d) {
  const ids = (d.ids || []).map(String);
  if (!ids.length) return json({ ok: true, deleted: 0 });
  const r = await db.prepare(`UPDATE orders SET eliminato = ? WHERE COALESCE(eliminato,'') = '' AND id IN (${ids.map(() => '?').join(',')})`).bind(now_(), ...ids).run();
  return json({ ok: true, deleted: r.meta.changes });
}
async function restore_(db, d) {
  const ids = (d.ids || []).map(String);
  if (!ids.length) return json({ ok: true, restored: 0 });
  const r = await db.prepare(`UPDATE orders SET eliminato = '' WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).run();
  return json({ ok: true, restored: r.meta.changes, available: await available_(db) });
}
/** Cancella per sempre (solo dal cestino) */
async function purge_(db, where, ...b) {
  const L = await all(db, `SELECT id FROM orders WHERE ${where}`, ...b);
  if (!L.length) return 0;
  const ids = L.map(o => o.id), marks = ids.map(() => '?').join(',');
  await db.prepare(`DELETE FROM payments WHERE order_id IN (${marks})`).bind(...ids).run();
  await db.prepare(`DELETE FROM orders WHERE id IN (${marks})`).bind(...ids).run();
  return ids.length;
}

/** Impostazioni: aperto/chiuso, messaggio, prezzi delle lattine (p3, p5) */
async function saveSettings_(db, d) {
  const st = [], put = (k, v) => st.push(db.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind(k, v));
  if ('open' in d) put('open', d.open ? '1' : '0');
  if ('msg' in d) put('msg', clean(d.msg, 300));
  for (const k of ['p3', 'p5']) if (k in d) {
    const v = price_(d[k]);
    if (!v && String(d[k]).trim() !== '') return json({ ok: false, error: 'Prezzo non valido per la lattina da ' + (k === 'p3' ? 3 : 5) + ' lt' });
    put(k, v ? String(v) : '');
  }
  if (st.length) await db.batch(st);
  return json({ ok: true, settings: await settings_(db) });
}

/** Aggiunge o modifica un utente: d.tk vuoto = nuovo; d.nome, d.ruolo ('intermedio'|'caricatore') */
async function userSave_(db, d) {
  const nome = clean(d.nome, 60), ruolo = d.ruolo === 'intermedio' ? 'intermedio' : 'caricatore';
  if (!nome) return json({ ok: false, error: 'Nome obbligatorio' });
  const list = await users_(db);
  if (list.some(x => x.nome.toLowerCase() === nome.toLowerCase() && x.tk !== d.tk)) return json({ ok: false, error: 'Esiste già un utente con questo nome' });
  if (d.tk) {
    const r = await db.prepare('UPDATE users SET nome = ?, ruolo = ? WHERE tk = ?').bind(nome, ruolo, String(d.tk)).run();
    if (!r.meta.changes) return json({ ok: false, error: 'Utente non trovato' });
  } else {
    await db.prepare('INSERT INTO users (tk, nome, ruolo, creato) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID().replace(/-/g, '').slice(0, 16), nome, ruolo, today_()).run();
  }
  return json({ ok: true, users: await users_(db) });
}
