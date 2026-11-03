# OliAmo

Prenotazione dell'olio extravergine – https://oliamo.boneggio.it

- `index.html` – pagina pubblica per prenotare lattine da 3 lt e da 5 lt (prezzi impostati dal report)
- `area.html?k=…` – pagina personale: carico dell'olio disponibile (litri) e, per l'utente intermedio, prenotazioni, olio dato a mano, costi e grafico
- `report.html` – report del gestore (password + verifica in due passaggi)
- `ordini.js` – scheda prenotazione (consegna in litri e pagamenti, anche parziali), olio disponibile, olio dato a mano
- `grafico.js` – grafico vendite / costi, anche per annata
- `tendine.js` – sezioni a tendina
- `functions/api.js` – motore (Cloudflare Pages Function), dati nel database Cloudflare D1 (`schema.sql`)
