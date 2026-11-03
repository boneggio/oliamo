-- OliAmo: quantità sempre in LITRI. q3 = lattine da 3 lt, q5 = lattine da 5 lt.
CREATE TABLE orders (id TEXT PRIMARY KEY, data TEXT NOT NULL, nome TEXT, cognome TEXT, telefono TEXT, q3 INTEGER DEFAULT 0, q5 INTEGER DEFAULT 0, litri INTEGER DEFAULT 0, euro REAL DEFAULT 0, note TEXT, pagato INTEGER DEFAULT 0, consegnato INTEGER DEFAULT 0, data_pag TEXT DEFAULT '', metodo TEXT DEFAULT '', per_il TEXT DEFAULT '', stato TEXT DEFAULT 'ok', consegnati INTEGER DEFAULT 0, eliminato TEXT DEFAULT '', mano INTEGER DEFAULT 0);
CREATE TABLE loads (id TEXT PRIMARY KEY, data TEXT NOT NULL, litri INTEGER NOT NULL, utente TEXT, note TEXT, ins TEXT);
CREATE TABLE costs (id TEXT PRIMARY KEY, data TEXT NOT NULL, descr TEXT, euro REAL NOT NULL, utente TEXT, ins TEXT, qta REAL DEFAULT 0, unita TEXT DEFAULT '');
CREATE TABLE users (tk TEXT PRIMARY KEY, nome TEXT NOT NULL, ruolo TEXT NOT NULL, creato TEXT);
CREATE TABLE settings (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE idem (rid TEXT PRIMARY KEY, res TEXT, ts INTEGER);
CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, data TEXT NOT NULL, euro REAL NOT NULL, metodo TEXT, utente TEXT, ins TEXT, litri INTEGER DEFAULT 0);
CREATE TABLE sessions (h TEXT PRIMARY KEY, creato TEXT, exp INTEGER);
