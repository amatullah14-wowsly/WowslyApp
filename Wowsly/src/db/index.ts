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
// INIT DB — FINAL SCHEMA (ONLY tickets + events + facility)
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
      given_check_in_time TEXT,       -- SQL timestamp for sync API
      registration_time TEXT,
      registered_by TEXT
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

  // FACILITY TABLE — use Kotlin-compatible column names
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS facility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_uuid TEXT,
      facilityId INTEGER,
      name TEXT,
      availableScans INTEGER DEFAULT 0,
      checkIn INTEGER DEFAULT 0,
      eventId INTEGER,
      ticket_id INTEGER,
      synced INTEGER DEFAULT 0
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

  const safeAddFacilityColumn = async (column: string, type: string) => {
    try {
      await database.executeSql(`ALTER TABLE facility ADD COLUMN ${column} ${type};`);
      console.log(`Migration added facility column: ${column}`);
    } catch (e) { }
  };

  await safeAddColumn("qrGuestUuid", "TEXT");
  await safeAddColumn("qrTicketId", "INTEGER");
  await safeAddColumn("check_in_count", "INTEGER DEFAULT 0");
  await safeAddColumn("given_check_in_time", "TEXT");

  // Ensure Kotlin columns exist (availableScans, checkIn)
  await safeAddFacilityColumn("availableScans", "INTEGER");
  await safeAddFacilityColumn("checkIn", "INTEGER");

  // Ensure ticket_id column on facility exists
  await safeAddFacilityColumn("ticket_id", "INTEGER");

  // MIGRATE OLD DATA (if previous schema used total_scans / used_scans or availableScans/checkIn naming might differ)
  try {
    // If platform previously added total_scans / used_scans, migrate them over to availableScans/checkIn
    await database.executeSql(`UPDATE facility SET availableScans = COALESCE(availableScans, total_scans) WHERE availableScans IS NULL;`);
    await database.executeSql(`UPDATE facility SET checkIn = COALESCE(checkIn, used_scans) WHERE checkIn IS NULL;`);
  } catch (e) {
    // ignore migration errors
  }

  return database;
}

// ======================================================
// INSERT DOWNLOADED GUESTS
// ======================================================
export async function insertOrReplaceGuests(eventId: number, guestsArray: any[]) {
  if (!Array.isArray(guestsArray) || guestsArray.length === 0) return;

  const db = await openDB();

  for (const g of guestsArray) {
    const qr = (g.qr_code || g.code || g.uuid || g.guest_uuid || '').toString().trim();
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

    let usedEntries = g.used_entries || g.checked_in_count || 0;

    // ⚡⚡⚡ SYNC FIX: If status is checked_in, ensure we mark as used ⚡⚡⚡
    if (status === 'checked_in' && usedEntries === 0) {
      usedEntries = 1;
    }

    const facilities = g.facilities ? JSON.stringify(g.facilities) : null;

    // ⚠️ CRITICAL: Store backend sync required fields
    const qrGuestUuid = g.guest_uuid || g.uuid || null;
    const qrTicketId = ticketId;

    // INSERT FACILITIES 
    if (g.facilities && Array.isArray(g.facilities)) {
      await insertFacilities(eventId, qrGuestUuid, g.facilities);
    }

    await db.executeSql(
      `INSERT OR REPLACE INTO tickets 
        (event_id, ticket_id, guest_id, qr_code, guest_name, email, phone, 
         status, synced, total_entries, used_entries, facilities, ticket_title,
         qrGuestUuid, qrTicketId, registration_time, registered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        eventId,
        ticketId,
        guestId,
        qr,
        guestName,
        g.email || null,
        g.phone || g.mobile || g.phone_number || null,
        status,
        totalEntries,
        usedEntries,
        facilities,
        ticketTitle,
        qrGuestUuid,
        qrTicketId,
        g.registration_time || g.created_at || null,
        g.registered_by || 'Self'
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
export async function updateTicketStatusLocal(qrValue: string, newStatus = 'checked_in', count = 1, synced = false) {
  const db = await openDB();
  const iso = new Date().toISOString();
  const sqlTime = formatToSQLDatetime(iso);

  const [current] = await db.executeSql(
    `SELECT used_entries FROM tickets WHERE qr_code = ?;`,
    [qrValue.trim()]
  );

  const previouslyUsed = current.rows.length > 0 ? current.rows.item(0).used_entries : 0;
  const newUsedEntries = previouslyUsed + count;

  await db.executeSql(
    `UPDATE tickets 
        SET status = ?, 
            scanned_at = ?, 
            synced = ?, 
            used_entries = ?, 
            check_in_count = ?, 
            given_check_in_time = ?
      WHERE qr_code = ?;`,
    [
      newStatus,
      iso,
      synced ? 1 : 0, // Use passed value
      newUsedEntries,
      newUsedEntries, // keep total check-in count aligned with used_entries
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
// GET TICKETS PAGINATED (OFFLINE)
// ======================================================
export async function getTicketsForEventPage(eventId: number, page: number = 1, limit: number = 100, search: string = '', filterStatus: string = 'All') {
  const db = await openDB();
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM tickets WHERE event_id = ?`;
  let countQuery = `SELECT COUNT(*) as total FROM tickets WHERE event_id = ?`;
  const params: any[] = [eventId];

  // STATUS FILTER
  if (filterStatus === 'Checked In') {
    const statusClause = ` AND (status = 'checked_in' OR used_entries > 0)`;
    query += statusClause;
    countQuery += statusClause;
  } else if (filterStatus === 'Pending') {
    const statusClause = ` AND (status != 'checked_in' AND used_entries = 0)`;
    query += statusClause;
    countQuery += statusClause;
  }

  // SEARCH FILTER
  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    const searchClause = ` AND (guest_name LIKE ? OR phone LIKE ? OR qr_code LIKE ? OR ticket_id LIKE ?)`;
    query += searchClause;
    countQuery += searchClause;
    params.push(s, s, s, s);
  }

  query += ` ORDER BY guest_name COLLATE NOCASE LIMIT ? OFFSET ?;`;

  const queryParams = [...params, limit, offset];

  const [res] = await db.executeSql(query, queryParams);
  const guests = [];
  for (let i = 0; i < res.rows.length; i++) guests.push(res.rows.item(i));

  const [countRes] = await db.executeSql(countQuery, params);
  const total = countRes.rows.item(0).total;

  return {
    guests,
    total,
    page,
    last_page: Math.ceil(total / limit)
  };
}

// ======================================================
// GET UNSYNCED CHECK-INS (FOR A GIVEN EVENT)
// ======================================================
export async function getUnsyncedCheckins(eventId?: number) {
  const db = await openDB();
  if (typeof eventId === 'number') {
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
  } else {
    // return all unsynced checkins across events
    const [res] = await db.executeSql(
      `SELECT * FROM tickets 
       WHERE synced = 0 
         AND check_in_count > 0
       LIMIT 500;`
    );
    const arr = [];
    for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
    return arr;
  }
}

// ======================================================
// GET ALL UNSYNCED CHECKINS (HELPER)
// ======================================================
export async function getAllUnsyncedCheckins() {
  return getUnsyncedCheckins(); // uses the branch that returns across events
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

  const placeholders = activeQrCodes.map(() => '?').join(',');

  const results = await db.executeSql(
    `DELETE FROM tickets WHERE event_id = ? AND synced = 1 AND qr_code NOT IN (${placeholders});`,
    [eventId, ...activeQrCodes.map(q => q.trim())]
  );
  const deletedCount = results[0]?.rowsAffected || 0;
  console.log(`Deleted ${deletedCount} stale guests for event ${eventId}`);
  return deletedCount;
}

// ======================================================
// GET EVENT SUMMARY (DYNAMIC)
// ======================================================
export async function getEventSummary(eventId: number) {
  const db = await openDB();
  const [res] = await db.executeSql(
    `SELECT 
       ticket_title, 
       COUNT(*) as count, 
       SUM(total_entries) as total_pax, 
       SUM(used_entries) as checked_in,
       SUM(CASE WHEN used_entries > 0 OR status = 'checked_in' THEN 1 ELSE 0 END) as guests_checked_in
     FROM tickets 
     WHERE event_id = ? 
     GROUP BY ticket_title;`,
    [eventId]
  );

  const arr = [];
  for (let i = 0; i < res.rows.length; i++) {
    arr.push(res.rows.item(i));
  }
  return arr;
}

// ======================================================
// GET GUEST COUNT (SIMPLE)
// ======================================================
export async function getGuestCount(eventId: number) {
  const db = await openDB();
  const [res] = await db.executeSql(
    `SELECT COUNT(*) as total FROM tickets WHERE event_id = ?;`,
    [eventId]
  );
  return res.rows.item(0).total || 0;
}

// ======================================================
// FACILITY METHODS (KOTLIN-NAMED COLUMNS)
// ======================================================

export async function insertFacilities(eventId: number, guestUuid: string, facilities: any[]) {
  if (!facilities || facilities.length === 0) return;
  const db = await openDB();

  for (const f of facilities) {
    const totalScans = parseInt(
      f.scan_quantity ?? f.quantity ?? f.total_scans ?? 1,
      10
    ) || 1; // default to 1 to allow facility usage

    const usedScans = parseInt(
      f.scanned_count ?? f.check_in_count ?? 0,
      10
    );

    // Clean old duplicates for this guest+facility
    await db.executeSql(
      `DELETE FROM facility WHERE guest_uuid = ? AND facilityId = ?;`,
      [guestUuid, f.id]
    );

    await db.executeSql(
      `INSERT INTO facility (guest_uuid, facilityId, name, availableScans, checkIn, eventId, synced)
       VALUES (?, ?, ?, ?, ?, ?, 1);`,
      [guestUuid, f.id, f.name, totalScans, usedScans, eventId]
    );
  }
}


export async function insertFacilityForGuest({
  guest_uuid, facilityId, name, availableScans, checkIn, eventId, ticket_id
}: { guest_uuid: string, facilityId: number, name: string, availableScans: number, checkIn: number, eventId?: number, ticket_id?: number }) {
  const db = await openDB();

  await db.executeSql(
    `DELETE FROM facility WHERE guest_uuid = ? AND facilityId = ?`,
    [guest_uuid, facilityId]
  );

  await db.executeSql(
    `INSERT INTO facility (guest_uuid, facilityId, name, availableScans, checkIn, eventId, ticket_id, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [guest_uuid, facilityId, name, availableScans, checkIn, eventId, ticket_id]
  );
}

export async function getFacilitiesForGuest(guestUuid: string) {
  const db = await openDB();
  // Return rows with expected field names used by UI: facilityId, name, availableScans, checkIn
  const [res] = await db.executeSql(
    `SELECT facilityId, name, availableScans, checkIn FROM facility WHERE guest_uuid = ?`,
    [guestUuid]
  );

  const arr = [];
  for (let i = 0; i < res.rows.length; i++) {
    arr.push(res.rows.item(i));
  }
  return arr;
}

export async function updateFacilityCheckInLocal(
  guestUuid: string,
  facilityId: number,
  increment: number = 1
) {
  const db = await openDB();

  // 🔒 Prevent over check-in using WHERE clause so rowsAffected is 0 if full
  const [result] = await db.executeSql(
    `
    UPDATE facility
    SET 
      checkIn = checkIn + ?,
      synced = 0
    WHERE guest_uuid = ? 
      AND facilityId = ?
      AND checkIn + ? <= COALESCE(availableScans, 1)
    `,
    [increment, guestUuid, facilityId, increment]
  );

  // Return number of rows actually updated
  return result.rowsAffected;
}


export async function getUnsyncedFacilities(eventId: number) {
  const db = await openDB();
  // Select using Kotlin column names, aliasing to match older consumers if needed
  const [res] = await db.executeSql(
    `SELECT id, guest_uuid, facilityId, name, availableScans, checkIn, eventId, ticket_id FROM facility WHERE eventId = ? AND synced = 0 AND checkIn > 0;`,
    [eventId]
  );

  const arr = [];
  for (let i = 0; i < res.rows.length; i++) {
    arr.push(res.rows.item(i));
  }
  return arr;
}

export async function markFacilitiesAsSynced(ids: number[]) {
  if (!ids || ids.length === 0) return;
  const db = await openDB();
  const placeholders = ids.map(() => '?').join(',');

  await db.executeSql(
    `UPDATE facility SET synced = 1 WHERE id IN (${placeholders});`,
    ids
  );
}
