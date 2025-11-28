/* src/db/index.ts */
import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

const DB_NAME = 'wowsly.db';
let db: SQLite.SQLiteDatabase | null = null;

export async function openDB() {
  if (db) return db;
  db = await SQLite.openDatabase({ name: DB_NAME, location: 'default' });
  return db;
}

export async function closeDB() {
  if (db) {
    await db.close();
    db = null;
  }
}

export async function initDB() {
  const database = await openDB();
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      ticket_id INTEGER,
      guest_id INTEGER,
      qr_code TEXT UNIQUE,
      guest_name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'pending',
      scanned_at TEXT,
      synced INTEGER DEFAULT 0
    );

      CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    guest_id INTEGER,
    ticket_id INTEGER,
    qr_code TEXT,
    scanned_at TEXT,
    synced INTEGER DEFAULT 0
  );
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER UNIQUE,
      name TEXT,
      last_downloaded_at TEXT
    );
  `);
  return database;
}

export async function insertOrReplaceGuests(eventId: number, guestsArray: any[] = []) {
  if (!Array.isArray(guestsArray) || guestsArray.length === 0) return;
  const database = await openDB();

  // Use executeSql directly instead of transaction with async callback
  for (const g of guestsArray) {
    const qr = (g.qr_code || g.qr || g.code || g.uuid || g.guest_uuid || '').toString().trim();
    const guestName = g.name || `${g.first_name || ''} ${g.last_name || ''}`.trim();
    const ticketId = g.ticket_id || g.id || null;
    const guestId = g.guest_id || g.user_id || null;
    const status = g.status || 'pending';

    try {
      await database.executeSql(
        `INSERT OR REPLACE INTO tickets (event_id, ticket_id, guest_id, qr_code, guest_name, email, phone, status, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
        [eventId, ticketId, guestId, qr, guestName, g.email || null, g.phone || null, status]
      );
    } catch (error) {
      console.error('Error inserting guest:', error);
    }
  }
  console.log(`Inserted/Updated ${guestsArray.length} guests for event ${eventId}`);
}

export async function findTicketByQr(qrValue: string) {
  if (!qrValue) return null;
  const database = await openDB();
  const [result] = await database.executeSql(
    `SELECT * FROM tickets WHERE qr_code = ? LIMIT 1;`,
    [qrValue.trim()]
  );
  if (result.rows.length > 0) return result.rows.item(0);
  return null;
}

export async function updateTicketStatusLocal(qrValue: string, newStatus = 'checked_in') {
  const database = await openDB();
  const now = new Date().toISOString();
  await database.executeSql(
    `UPDATE tickets SET status = ?, scanned_at = ?, synced = 0 WHERE qr_code = ?;`,
    [newStatus, now, qrValue.trim()]
  );
}

export async function getTicketsForEvent(eventId: number) {
  const database = await openDB();
  const [result] = await database.executeSql(
    `SELECT * FROM tickets WHERE event_id = ? ORDER BY guest_name COLLATE NOCASE;`,
    [eventId]
  );
  const items = [];
  for (let i = 0; i < result.rows.length; i++) items.push(result.rows.item(i));
  return items;
}

export async function getUnsyncedCheckins() {
  const database = await openDB();
  const [result] = await database.executeSql(
    `SELECT * FROM tickets WHERE synced = 0 AND status = 'checked_in' LIMIT 500;`
  );
  const items = [];
  for (let i = 0; i < result.rows.length; i++) items.push(result.rows.item(i));
  return items;
}

export async function markTicketsAsSynced(qrCodes: string[] = []) {
  if (!qrCodes || qrCodes.length === 0) return;
  const database = await openDB();
  const placeholders = qrCodes.map(() => '?').join(',');
  await database.executeSql(
    `UPDATE tickets SET synced = 1 WHERE qr_code IN (${placeholders});`,
    qrCodes.map(q => q.trim())
  );
}
