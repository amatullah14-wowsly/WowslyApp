/* src/db/index.ts */
import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

const DB_NAME = 'wowsly.db';
let db: SQLite.SQLiteDatabase | null = null;

// ======================================================
// OPEN / CLOSE
// ======================================================
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

// ======================================================
// INIT DB — FINAL SCHEMA (ONLY tickets + events)
// ======================================================
export async function initDB() {
  const database = await openDB();

  // ------------------------
  // TICKETS = FULL SOURCE OF TRUTH
  // ------------------------
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

      scanned_at TEXT,              -- ISO timestamp
      synced INTEGER DEFAULT 1,      -- 0 = needs sync

      total_entries INTEGER DEFAULT 1,
      used_entries INTEGER DEFAULT 0,
      facilities TEXT,
      ticket_title TEXT,

      qrGuestUuid TEXT,              -- required for sync API
      qrTicketId INTEGER,            -- ticket_id mapped for sync API
      check_in_count INTEGER DEFAULT 0,
      given_check_in_time TEXT       -- SQL timestamp for sync API
    );
  `);

  // EVENTS TABLE
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER UNIQUE,
      name TEXT,
      last_downloaded_at TEXT
    );
  `);

  // ------------------------
  // MIGRATIONS (safe)
  // ------------------------
  const safeAddColumn = async (column: string, type: string) => {
    try {
      await database.executeSql(`ALTER TABLE tickets ADD COLUMN ${column} ${type};`);
      console.log(`Migration added column: ${column}`);
    } catch (e) { }
  };

  await safeAddColumn("qrGuestUuid", "TEXT");
  await safeAddColumn("qrTicketId", "INTEGER");
  await safeAddColumn("check_in_count", "INTEGER DEFAULT 0");
  await safeAddColumn("given_check_in_time", "TEXT");

  return database;
}

// ======================================================
// INSERT DOWNLOADED GUESTS
// ======================================================
export async function insertOrReplaceGuests(eventId: number, guestsArray: any[]) {
  if (!Array.isArray(guestsArray) || guestsArray.length === 0) return;

  const db = await openDB();

  for (const g of guestsArray) {
    const qr = (g.qr_code || g.code || g.uuid || '').toString().trim();
    const guestName = g.name || `${g.first_name || ''} ${g.last_name || ''}`.trim();

    const ticketId = g.ticket_id || g.id || null;
    const guestId = g.guest_id || g.user_id || null;
    const status = g.status || 'pending';
    const ticketTitle = g.ticket_title || g.ticket_name || g.ticket_type || 'General';

    const totalEntries =
      g.ticket_data?.tickets_bought ||
      g.tickets_bought ||
      g.total_entries ||
      g.total_pax ||
      g.quantity ||
      1;

    const usedEntries = g.used_entries || g.checked_in_count || 0;

    const facilities = g.facilities ? JSON.stringify(g.facilities) : null;

    // ⚠️ CRITICAL: Store backend sync required fields
    const qrGuestUuid = g.guest_uuid || g.uuid || null;
    const qrTicketId = ticketId;

    await db.executeSql(
      `INSERT OR REPLACE INTO tickets 
        (event_id, ticket_id, guest_id, qr_code, guest_name, email, phone, 
         status, synced, total_entries, used_entries, facilities, ticket_title,
         qrGuestUuid, qrTicketId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?);`,
      [
        eventId,
        ticketId,
        guestId,
        qr,
        guestName,
        g.email || null,
        g.phone || null,
        status,
        totalEntries,
        usedEntries,
        facilities,
        ticketTitle,
        qrGuestUuid,
        qrTicketId
      ]
    );
  }
}

// ======================================================
// FIND TICKET BY QR
// ======================================================
export async function findTicketByQr(qrValue: string) {
  if (!qrValue) return null;
  const db = await openDB();

  const [res] = await db.executeSql(
    `SELECT * FROM tickets WHERE qr_code = ? LIMIT 1;`,
    [qrValue.trim()]
  );

  return res.rows.length > 0 ? res.rows.item(0) : null;
}

// ======================================================
// UPDATE LOCAL TICKET ON SCAN (OFFLINE)
// ======================================================
export async function updateTicketStatusLocal(qrValue: string, newStatus = 'checked_in', count = 1) {
  const db = await openDB();
  const iso = new Date().toISOString();
  const sqlTime = formatToSQLDatetime(iso);

  const [current] = await db.executeSql(
    `SELECT used_entries FROM tickets WHERE qr_code = ?;`,
    [qrValue.trim()]
  );

  const previouslyUsed = current.rows.length > 0 ? current.rows.item(0).used_entries : 0;

  await db.executeSql(
    `UPDATE tickets 
        SET status = ?, 
            scanned_at = ?, 
            synced = 0, 
            used_entries = ?, 
            check_in_count = ?, 
            given_check_in_time = ?
      WHERE qr_code = ?;`,
    [
      newStatus,
      iso,
      previouslyUsed + count,
      count,
      sqlTime,
      qrValue.trim()
    ]
  );
}

// ======================================================
// GET ALL TICKETS FOR EVENT
// ======================================================
export async function getTicketsForEvent(eventId: number) {
  const db = await openDB();
  const [res] = await db.executeSql(
    `SELECT * FROM tickets WHERE event_id = ? ORDER BY guest_name COLLATE NOCASE;`,
    [eventId]
  );

  const arr = [];
  for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
  return arr;
}

// ======================================================
// GET UNSYNCED CHECK-INS
// ======================================================
export async function getUnsyncedCheckins(eventId: number) {
  const db = await openDB();
  const [res] = await db.executeSql(
    `SELECT * FROM tickets 
     WHERE event_id = ? 
       AND synced = 0 
       AND check_in_count > 0
     LIMIT 500;`,
    [eventId]
  );

  const arr = [];
  for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
  return arr;
}

// ======================================================
// MARK AS SYNCED
// ======================================================
export async function markTicketsAsSynced(qrCodes: string[]) {
  if (!qrCodes || qrCodes.length === 0) return;

  const db = await openDB();
  const placeholders = qrCodes.map(() => '?').join(',');

  await db.executeSql(
    `UPDATE tickets SET synced = 1 WHERE qr_code IN (${placeholders});`,
    qrCodes.map(q => q.trim())
  );
}

// ======================================================
// HELPERS
// ======================================================
export function formatToSQLDatetime(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ======================================================
// GET LOCAL CHECKED-IN GUESTS
// ======================================================
export async function getLocalCheckedInGuests(eventId: number) {
  const db = await openDB();
  const [res] = await db.executeSql(
    `SELECT * FROM tickets WHERE event_id = ? AND (status = 'checked_in' OR used_entries > 0);`,
    [eventId]
  );
  const arr = [];
  for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
  return arr;
}

// ======================================================
// DELETE STALE GUESTS
// ======================================================
export async function deleteStaleGuests(eventId: number, activeQrCodes: string[] = []) {
  if (!activeQrCodes || activeQrCodes.length === 0) return;
  const db = await openDB();

  // Delete tickets for this event that are NOT in the active list AND are already synced (safe to delete)
  // We do NOT delete synced=0 (pending offline scans)
  const placeholders = activeQrCodes.map(() => '?').join(',');

  await db.executeSql(
    `DELETE FROM tickets WHERE event_id = ? AND synced = 1 AND qr_code NOT IN (${placeholders});`,
    [eventId, ...activeQrCodes.map(q => q.trim())]
  );
  console.log(`Deleted stale guests for event ${eventId}`);
}
