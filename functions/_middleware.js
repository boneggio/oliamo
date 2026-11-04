/**
 * OliAmo – sito riservato.
 * Se nel report è acceso "Sito riservato", la pagina pubblica si apre solo con il link
 * https://oliamo.boneggio.it/?c=CODICE (il codice si cambia dal report: quello vecchio smette di valere).
 * Chi apre il link una volta resta dentro (cookie oli_inv per un anno). Report, aree personali e immagini non cambiano.
 */
const PAGINE = new Set(['/', '/index.html', '/index']);

const RISERVATA = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>OliAmo – pagina riservata</title>
<meta property="og:title" content="OliAmo – Olio extravergine">
<meta property="og:description" content="Pagina riservata: chiedi il link a chi ti ha parlato del nostro olio.">
<meta property="og:image" content="https://oliamo.boneggio.it/og-image.jpg?v=2">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,900&family=Plus+Jakarta+Sans:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#FFFBEA;--card:#FFFFFF;--ink:#24300E;--muted:#5B6431;--brand:#3D7A0E}
@media (prefers-color-scheme:dark){:root{--bg:#141808;--card:#1E2410;--ink:#F4F6E4;--muted:#C2C79A;--brand:#A8D65A}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font:16px/1.55 'Plus Jakarta Sans',system-ui,sans-serif;text-align:center}
main{max-width:420px;background:var(--card);border-radius:26px;padding:30px 24px;box-shadow:0 18px 40px -24px rgba(90,80,10,.55)}
img{width:110px;height:110px;border-radius:50%;background:#fff;padding:5px;box-shadow:0 12px 28px rgba(110,80,0,.3)}
h1{font-family:Fraunces,Georgia,serif;font-weight:900;font-size:2.4rem;margin:.3em 0 .1em;color:var(--brand)}
p{margin:.6em 0 0;color:var(--muted)}
b{color:var(--ink)}
</style></head>
<body><main>
<img src="/logo.svg" alt="">
<h1>OliAmo</h1>
<p><b>Questa pagina è riservata.</b></p>
<p>Chiedi il link a chi ti ha parlato del nostro olio.</p>
</main></body></html>`;

const cookieOf = (request, k) => { const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + k + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; };

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!PAGINE.has(url.pathname)) return next();
  const s = {};
  try { (await env.DB.prepare("SELECT k, v FROM settings WHERE k IN ('riservato','invito')").all()).results.forEach(r => s[r.k] = r.v); }
  catch (e) { return next(); }
  if (s.riservato !== '1') return next();
  const inv = s.invito || '', q = (url.searchParams.get('c') || '').trim().toLowerCase(), c = cookieOf(request, 'oli_inv');
  if (inv && (q === inv || c === inv)) {
    const res = await next(), r = new Response(res.body, res);
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    r.headers.set('Cache-Control', 'no-store');
    if (q === inv && c !== inv) r.headers.append('Set-Cookie', 'oli_inv=' + encodeURIComponent(inv) + '; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax');
    return r;
  }
  return new Response(RISERVATA, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
