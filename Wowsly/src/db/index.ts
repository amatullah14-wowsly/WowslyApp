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
  // MIGRATION: Ensure tickets table has correct constraints
  // Constraint: UNIQUE(event_id, qrGuestUuid, qrTicketId)
  // Constraint: qr_code IS NOT UNIQUE
  // ------------------------
  try {
    // Check if tickets table exists
    const [check] = await database.executeSql(`SELECT name FROM sqlite_master WHERE type='table' AND name='tickets';`);
    if (check.rows.length > 0) {

      const [schemaRes] = await database.executeSql(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets';`);
      const schemaSql = schemaRes.rows.item(0).sql;

      // If we detect strict UNIQUE on qr_code, we must migrate
      if (schemaSql.includes('qr_code TEXT UNIQUE')) {
        console.log("STARTING TICKETS TABLE RECREATION MIGRATION...");
        await database.transaction(async (tx: any) => {
          // 1. Rename old
          await tx.executeSql(`ALTER TABLE tickets RENAME TO tickets_old_v1;`);

          // 2. Create new (Correct Schema)
          await tx.executeSql(`
                 CREATE TABLE tickets (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   event_id INTEGER NOT NULL,
                   ticket_id INTEGER,
                   guest_id INTEGER,
                   qr_code TEXT,
                   guest_name TEXT,
                   email TEXT,
                   phone TEXT,
                   status TEXT DEFAULT 'pending',
                   scanned_at TEXT,
                   synced INTEGER DEFAULT 1,
                   total_entries INTEGER DEFAULT 1,
                   used_entries INTEGER DEFAULT 0,
                   facilities TEXT,
                   ticket_title TEXT,
                   qrGuestUuid TEXT,
                   qrTicketId INTEGER,
                   check_in_count INTEGER DEFAULT 0,
                   given_check_in_time TEXT,
                   registration_time TEXT,
                   registered_by TEXT
                 );
             `);

          // 3. Copy Data
          await tx.executeSql(`
                 INSERT INTO tickets (
                     id, event_id, ticket_id, guest_id, qr_code, guest_name, email, phone, status, 
                     scanned_at, synced, total_entries, used_entries, facilities, ticket_title,
                     qrGuestUuid, qrTicketId, check_in_count, given_check_in_time, registration_time, registered_by
                 )
                 SELECT 
                     id, event_id, ticket_id, guest_id, qr_code, guest_name, email, phone, status, 
                     scanned_at, synced, total_entries, used_entries, facilities, ticket_title,
                     qrGuestUuid, qrTicketId, check_in_count, given_check_in_time, registration_time, registered_by
                 FROM tickets_old_v1;
             `);

          // 4. Drop old
          await tx.executeSql(`DROP TABLE tickets_old_v1;`);
        });
        console.log("TICKETS TABLE MIGRATION COMPLETE.");
      }
    }
  } catch (err) {
    console.log("Migration Error (Non-fatal, continuing):", err);
  }

  // ------------------------
  // TICKETS = FULL SOURCE OF TRUTH
  // ------------------------
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      ticket_id INTEGER,
      guest_id INTEGER,
      qr_code TEXT,
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

  const safeAddIndex = async (tableName: string, indexName: string, columns: string, unique = false) => {
    try {
      await database.executeSql(`CREATE ${unique ? 'UNIQUE' : ''} INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columns});`);
      console.log(`Migration added index: ${indexName} on ${tableName}`);
    } catch (e) {
      console.log(`Index creation failed (might already exist): ${indexName}`, e);
    }
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

  // PERFOMANCE INDICES
  await safeAddIndex("tickets", "idx_tickets_event_id", "event_id");
  await safeAddIndex("tickets", "idx_tickets_qr_code", "qr_code");
  await safeAddIndex("tickets", "idx_tickets_guest_name", "guest_name");
  await safeAddIndex("tickets", "idx_tickets_status", "status");

  // ⚡⚡⚡ ENFORCE IDENTITY RULE ⚡⚡⚡
  // UNIQUE(event_id, qrGuestUuid)
  await safeAddIndex("tickets", "idx_tickets_identity", "event_id, qrGuestUuid", true);

  await safeAddIndex("facility", "idx_facility_guest_uuid", "guest_uuid");
  await safeAddIndex("facility", "idx_facility_facilityId", "facilityId");
  await safeAddIndex("facility", "idx_facility_eventId", "eventId");

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
// INSERT DOWNLOADED GUESTS (OPTIMIZED WITH BATCHING)
// ======================================================
// ======================================================
// ATOMIC FULL SYNC: DELETE ALL CLEAN + INSERT NEW
// ======================================================
export async function replaceAllGuestsForEvent(eventId: number, guestsArray: any[], isFullSync: boolean = true) {
  if (!Array.isArray(guestsArray)) return;
  console.log(`[DB] replaceAllGuestsForEvent called. EventId: ${eventId}, Guests: ${guestsArray.length}, isFullSync: ${isFullSync}`);

  const db = await openDB();

  // 1. Identify Unsynced Guests (Protected Set)
  // We must NOT overwrite these guests as they have pending offline check-ins
  const [unsyncedRes] = await db.executeSql(
    `SELECT qrGuestUuid, qrTicketId FROM tickets WHERE event_id = ? AND synced = 0;`,
    [eventId]
  );

  const protectedSet = new Set<string>();
  for (let i = 0; i < unsyncedRes.rows.length; i++) {
    const item = unsyncedRes.rows.item(i);
    // Key: guestUuid (Guest-Based Identity)
    protectedSet.add(item.qrGuestUuid);
  }

  // 2. Identify Unsynced Facilities (Protected Set)
  const [unsyncedFacRes] = await db.executeSql(
    `SELECT guest_uuid, facilityId FROM facility WHERE eventId = ? AND synced = 0;`,
    [eventId]
  );
  const protectedFacilities = new Set<string>();
  for (let i = 0; i < unsyncedFacRes.rows.length; i++) {
    const item = unsyncedFacRes.rows.item(i);
    protectedFacilities.add(`${item.guest_uuid}_${item.facilityId}`);
  }

  // ⚡⚡⚡ MANUAL TRANSACTION START ⚡⚡⚡
  // Using explicit BEGIN/COMMIT allows us to await Promises reliably in the loop
  try {
    await db.executeSql('BEGIN EXCLUSIVE TRANSACTION;');

    // 3. DELETE CLEAN DATA (Mocking "Delete All")
    // Only delete rows that are synced=1. Unsynced rows stay untouched.
    if (isFullSync) {
      console.log(`[DB] DELETING synced tickets and facilities for event ${eventId}`);
      await db.executeSql(`DELETE FROM tickets WHERE event_id = ? AND synced = 1;`, [eventId]);
      await db.executeSql(`DELETE FROM facility WHERE eventId = ? AND synced = 1;`, [eventId]);
    }

    // 4. INSERT FRESH DATA (Skipping Protected) in BATCHES
    // We cannot simply push 16,000 promises. We must batch them.
    const BATCH_SIZE = 100;
    const allFacilitiesToInsert: { eventId: number, qrGuestUuid: string, ticketId: any, facility: any }[] = [];

    let currentBatch: Promise<any>[] = [];
    let processedCount = 0;

    for (const g of guestsArray) {
      // ⚡⚡⚡ CORRECT TICKET ID EXTRACTION ⚡⚡⚡
      const ticketId =
        g.ticket_id ??
        g.ticket?.id ??
        g.ticket_data?.ticket_id ??
        g.ticket_data?.id ??
        null;

      if (!ticketId) {
        console.warn("[DB] ⚠️ Missing ticket_id for guest:", g.guest_uuid || g.uuid, JSON.stringify(g).substring(0, 100));
      }

      const qrGuestUuid = g.guest_uuid || g.uuid || null;

      // IDENTITY CHECK: If this guest is locally modified, SKIP overwrite
      if (protectedSet.has(qrGuestUuid)) {
        continue;
      }

      // PREPARE DATA
      const qr = (g.qr_code || g.code || g.uuid || g.guest_uuid || '').toString().trim();
      const guestName = g.name || `${g.first_name || ''} ${g.last_name || ''}`.trim();
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
      if (status === 'checked_in' && usedEntries === 0) usedEntries = 1;

      const facilities = g.facilities ? JSON.stringify(g.facilities) : null;

      // STAGE FACILITIES
      if (g.facilities && Array.isArray(g.facilities)) {
        g.facilities.forEach((fac: any) => {
          const facKey = `${qrGuestUuid}_${fac.id}`;
          if (!protectedFacilities.has(facKey)) {
            allFacilitiesToInsert.push({
              eventId,
              qrGuestUuid,
              ticketId,
              facility: fac
            });
          }
        });
      }

      // INSERT USING db.executeSql DIRECTLY (Promise enabled)
      currentBatch.push(
        db.executeSql(
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
            ticketId,
            g.registration_time || g.created_at || null,
            g.registered_by || 'Self'
          ]
        )
      );

      // Execute Batch if full
      if (currentBatch.length >= BATCH_SIZE) {
        await Promise.all(currentBatch);
        processedCount += currentBatch.length;
        currentBatch = [];
        // Optional: logging every 1000 items
        if (processedCount % 1000 === 0) console.log(`[DB] Inserted ${processedCount} guests...`);
      }
    }

    // Execute Remaining
    if (currentBatch.length > 0) {
      await Promise.all(currentBatch);
      processedCount += currentBatch.length;
    }

    console.log(`[DB] Inserted/Verified ${processedCount} guests.`);

    // 5. BATCH INSERT FACILITIES (OPTIMIZED MULTI-ROW INSERT)
    // Reduce 32,000 calls to ~600 calls
    console.log(`[DB] Starting optimized facility insertion. Count: ${allFacilitiesToInsert.length}`);

    // SQLite limit is 999 params. 8 params per facility.
    // 999 / 8 = 124. Safe chunk size = 100.
    const FACILITY_CHUNK_SIZE = 100;

    for (let i = 0; i < allFacilitiesToInsert.length; i += FACILITY_CHUNK_SIZE) {
      const chunk = allFacilitiesToInsert.slice(i, i + FACILITY_CHUNK_SIZE);
      const rowPlaceholders = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, 1)`).join(', ');

      const params: any[] = [];
      chunk.forEach(item => {
        const f = item.facility;
        const totalScans = parseInt(f.scan_quantity ?? f.quantity ?? f.total_scans ?? 1, 10) || 1;
        const usedScans = parseInt(f.scanned_count ?? f.check_in_count ?? 0, 10);

        params.push(
          item.qrGuestUuid,
          f.id,
          f.name,
          totalScans,
          usedScans,
          item.eventId,
          item.ticketId
        );
      });

      await db.executeSql(
        `INSERT INTO facility (guest_uuid, facilityId, name, availableScans, checkIn, eventId, ticket_id, synced)
         VALUES ${rowPlaceholders};`,
        params
      );

      // Log progress periodically
      if ((i + chunk.length) % 2000 === 0) {
        console.log(`[DB] Inserted ${i + chunk.length} facilities...`);
      }
    }

    await db.executeSql('COMMIT;');
    console.log(`[DB] Transaction COMMITTED successfully.`);

  } catch (error) {
    console.error('[DB] Transaction FAILED. Rolling back.', error);
    try {
      await db.executeSql('ROLLBACK;');
    } catch (rbError) {
      console.error('[DB] Rollback failed:', rbError);
    }
    throw error; // Re-throw to alert caller
  }
} // End Function

// ALIAS for backward compatibility if needed, but we should switch consumers to replaceAllGuestsForEvent
export const insertOrReplaceGuests = replaceAllGuestsForEvent;

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
// STRICT GATE ENTRY CHECK-IN (OFFLINE)
// ======================================================
// ======================================================
// STRICT GATE ENTRY CHECK-IN (OFFLINE)
// ======================================================
// ======================================================
// STRICT GATE ENTRY CHECK-IN (OFFLINE)
// ======================================================
export async function performGateCheckIn(eventId: number, qrGuestUuid: string) {
  const db = await openDB();
  const iso = new Date().toISOString();
  const sqlTime = formatToSQLDatetime(iso);

  // STRICT RULE: Update ONLY if used_entries = 0
  // REFACTORED: Guest-based identity (qrGuestUuid), ignoring ticket_id uniqueness
  const [result] = await db.executeSql(
    `UPDATE tickets 
     SET status = 'checked_in',
         used_entries = 1,
         check_in_count = 1,
         scanned_at = ?,
         synced = 0,
         given_check_in_time = ?
     WHERE event_id = ? 
       AND qrGuestUuid = ? 
       AND (used_entries IS NULL OR used_entries = 0)`,
    [iso, sqlTime, eventId, qrGuestUuid]
  );

  return result.rowsAffected;
}

// ======================================================
// UPDATE LOCAL TICKET ON SCAN (OFFLINE)
// ======================================================
export async function updateTicketStatusLocal(qrValue: string, newStatus = 'checked_in', count = 1, synced = false) {
  const db = await openDB();
  const iso = new Date().toISOString();
  const sqlTime = formatToSQLDatetime(iso);

  // 1. FIND IDENTITY FROM QR
  const [current] = await db.executeSql(
    `SELECT qrGuestUuid, qrTicketId, used_entries FROM tickets WHERE qr_code = ? LIMIT 1;`,
    [qrValue.trim()]
  );

  if (current.rows.length === 0) return 0; // Not found

  const row = current.rows.item(0);
  const { qrGuestUuid, qrTicketId, used_entries } = row;
  const newUsedEntries = (used_entries || 0) + count;

  // 2. UPDATE BY IDENTITY (qrGuestUuid + qrTicketId)
  const [result] = await db.executeSql(
    `UPDATE tickets 
        SET status = ?, 
            scanned_at = ?, 
            synced = ?, 
            used_entries = ?, 
            check_in_count = ?, 
            given_check_in_time = ?
      WHERE qrGuestUuid = ? AND qrTicketId = ?;`,
    [
      newStatus,
      iso,
      synced ? 1 : 0,
      newUsedEntries,
      newUsedEntries,
      sqlTime,
      qrGuestUuid,
      qrTicketId
    ]
  );

  return result.rowsAffected;
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
  console.log(`[DB] getTicketsForEvent returned ${arr.length} tickets for event ${eventId}`);
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

  // ⚡⚡⚡ FIX: Unstable sort caused duplicate items across pages ⚡⚡⚡
  query += ` ORDER BY guest_name COLLATE NOCASE, id ASC LIMIT ? OFFSET ?;`;

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
  console.log(`[DB] getEventSummary executed for event ${eventId}. Rows: ${res.rows.length}`);

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

  await db.transaction(async (tx) => {
    for (const f of facilities) {
      const totalScans = parseInt(
        f.scan_quantity ?? f.quantity ?? f.total_scans ?? 1,
        10
      ) || 1;

      const usedScans = parseInt(
        f.scanned_count ?? f.check_in_count ?? 0,
        10
      );

      // Clean old duplicates for this guest+facility
      tx.executeSql(
        `DELETE FROM facility WHERE guest_uuid = ? AND facilityId = ?;`,
        [guestUuid, f.id]
      );

      tx.executeSql(
        `INSERT INTO facility (guest_uuid, facilityId, name, availableScans, checkIn, eventId, synced)
         VALUES (?, ?, ?, ?, ?, ?, 1);`,
        [guestUuid, f.id, f.name, totalScans, usedScans, eventId]
      );
    }
  });
}

/**
 * ⚡⚡⚡ BATCH OPTIMIZED FACILITY INSERT ⚡⚡⚡
 * Inserts a huge list of facilities using CHUNKED SQL statements.
 * DELETE by guest_uuid (in batches) then INSERT (in multivalue batches).
 */
export async function insertFacilitiesBatch(allFacilities: { eventId: number, qrGuestUuid: string, ticketId: any, facility: any }[]) {
  if (!allFacilities || allFacilities.length === 0) return;
  const db = await openDB();

  // 1. DEDUPLICATE: We perform DELETE by guest_uuid
  // If we have multiple facilities for one guest, we only need to delete once.
  const uniqueGuests = Array.from(new Set(allFacilities.map(f => f.qrGuestUuid)));

  // 2. DELETE OLD (Chunked)
  // We do this outside transaction or in it, but straightforward executeSql is fine for deletes.
  // Using IN clause for efficiency.
  const DELETE_CHUNK_SIZE = 50;
  for (let i = 0; i < uniqueGuests.length; i += DELETE_CHUNK_SIZE) {
    const chunk = uniqueGuests.slice(i, i + DELETE_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');

    await db.executeSql(
      `DELETE FROM facility WHERE guest_uuid IN (${placeholders});`,
      chunk
    );
  }

  // 3. INSERT NEW (Chunked Transaction)
  const INSERT_CHUNK_SIZE = 40;
  await db.transaction(async (tx) => {
    for (let i = 0; i < allFacilities.length; i += INSERT_CHUNK_SIZE) {
      const chunk = allFacilities.slice(i, i + INSERT_CHUNK_SIZE);

      const rowPlaceholders = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, 1)`).join(', ');

      const params: any[] = [];
      chunk.forEach(item => {
        const f = item.facility;
        const totalScans = parseInt(f.scan_quantity ?? f.quantity ?? f.total_scans ?? 1, 10) || 1;
        const usedScans = parseInt(f.scanned_count ?? f.check_in_count ?? 0, 10);

        params.push(
          item.qrGuestUuid,
          f.id,
          f.name,
          totalScans,
          usedScans,
          item.eventId,
          item.ticketId
        );
      });

      tx.executeSql(
        `INSERT INTO facility (guest_uuid, facilityId, name, availableScans, checkIn, eventId, ticket_id, synced)
          VALUES ${rowPlaceholders};`,
        params
      );
    }
  });
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

// ======================================================
// EVENT METADATA (Last Downloaded At)
// ======================================================
export async function getEventLastDownload(eventId: number) {
  const db = await openDB();
  // Ensure event exists
  await db.executeSql(`INSERT OR IGNORE INTO events (event_id, name) VALUES (?, 'Unknown');`, [eventId]);

  const [res] = await db.executeSql(
    `SELECT last_downloaded_at FROM events WHERE event_id = ?;`,
    [eventId]
  );

  return res.rows.length > 0 ? res.rows.item(0).last_downloaded_at : null;
}

export async function updateEventLastDownload(eventId: number) {
  const db = await openDB();
  const iso = new Date().toISOString(); // store as ISO

  // Ensure event exists
  await db.executeSql(`INSERT OR IGNORE INTO events (event_id, name) VALUES (?, 'Unknown');`, [eventId]);

  await db.executeSql(
    `UPDATE events SET last_downloaded_at = ? WHERE event_id = ?;`,
    [iso, eventId]
  );
  return iso;
}
