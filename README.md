# OliAmo

Prenotazione dell'olio extravergine – https://oliamo.boneggio.it

- `index.html` – pagina pubblica per richiedere l'olio: lattine e bottiglie nei formati e prezzi impostati dal report
- `area.html?k=…` – pagina personale: carico dell'olio disponibile (litri) e, per l'utente intermedio, prenotazioni, olio dato a mano, costi e grafico
- `report.html` – report del gestore (password + verifica in due passaggi)
- `ordini.js` – scheda prenotazione (consegna in litri e pagamenti, anche parziali), olio disponibile, olio dato a mano
- `grafico.js` – grafico vendite / costi, anche per annata
- `tendine.js` – sezioni a tendina
- `functions/api.js` – motore (Cloudflare Pages Function), dati nel database Cloudflare D1 (`schema.sql`)
