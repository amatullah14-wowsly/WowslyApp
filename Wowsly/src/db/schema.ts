export const createTicketsTable = `
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    guest_id INTEGER,
    ticket_id INTEGER,
    name TEXT,
    email TEXT,
    phone TEXT,
    qr_code TEXT UNIQUE,
    status TEXT,
    synced INTEGER DEFAULT 1
  );
`;

export const createCheckinsTable = `
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    guest_id INTEGER,
    ticket_id INTEGER,
    qr_code TEXT,
    scanned_at TEXT,
    synced INTEGER DEFAULT 0
  );
`;
