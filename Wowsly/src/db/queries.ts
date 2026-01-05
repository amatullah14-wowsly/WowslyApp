// src/db/queries.ts
import { openDB, formatToSQLDatetime } from "./index";

/**
 * Utility functions that use the core openDB() functions in index.ts.
 * This file replaces the previous getDB() usage and keeps queries readable.
 */

// -------------------- INSERT DOWNLOADED TICKETS --------------------
export async function saveTickets(tickets: any[]) {
  const db = await openDB();
  if (!Array.isArray(tickets) || tickets.length === 0) return;

  try {
    await db.transaction(async (tx: any) => {
      const insertQuery = `
        INSERT OR REPLACE INTO tickets
        (event_id, guest_id, ticket_id, guest_name, email, phone, qr_code, status, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;
      const promises = tickets.map(t =>
        tx.executeSql(insertQuery, [
          t.event_id,
          t.guest_id,
          t.ticket_id,
          t.name || t.guest_name || null,
          t.email || null,
          t.phone || t.mobile || t.phone_number || null,
          t.qr_code || t.code || null,
          t.status || 'pending'
        ])
      );
      await Promise.all(promises);
    });
  } catch (e) {
    console.log("SAVE TICKETS ERROR:", e);
  }
}

// -------------------- FIND TICKET BY QR --------------------
export async function getTicketByQR(qr: string) {
  const db = await openDB();
  const [res] = await db.executeSql("SELECT * FROM tickets WHERE qr_code = ? LIMIT 1", [qr]);
  return res.rows.length > 0 ? res.rows.item(0) : null;
}

// -------------------- STORE OFFLINE CHECK-IN --------------------
// Note: Your index.ts stores check-in directly into tickets table (check_in_count + synced flags).
// This function keeps the older "checkins" table approach if you used it; otherwise you can skip.
export async function saveOfflineCheckin(ticket: any) {
  const db = await openDB();

  // Prevent duplicates by qrGuestUuid
  const [existing] = await db.executeSql(
    "SELECT 1 FROM tickets WHERE qrGuestUuid = ? AND check_in_count > 0 LIMIT 1",
    [ticket.qrGuestUuid]
  );
  if (existing.rows.length > 0) return;

  const iso = ticket.scanned_at || new Date().toISOString();
  const sqlTime = formatToSQLDatetime(iso);

  // We will store directly in tickets by updating the check_in_count and synced flag
  await db.executeSql(
    `UPDATE tickets
     SET check_in_count = ?, given_check_in_time = ?, synced = 0, used_entries = used_entries + ?
     WHERE qrGuestUuid = ?`,
    [ticket.check_in_count || 1, sqlTime, ticket.check_in_count || 1, ticket.qrGuestUuid]
  );
}

// -------------------- GET ALL UNSYNCED CHECKINS --------------------
export async function getUnsyncedCheckinsAll() {
  const db = await openDB();
  const [res] = await db.executeSql("SELECT * FROM tickets WHERE synced = 0 AND check_in_count > 0");
  const arr = [];
  for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
  return arr;
}

// -------------------- MARK CHECKINS AS SYNCED --------------------
export async function markTicketsAsSynced(uuidList: string[]) {
  if (!uuidList || uuidList.length === 0) return;
  const db = await openDB();
  const placeholders = uuidList.map(() => "?").join(",");
  const query = `UPDATE tickets SET synced = 1 WHERE qrGuestUuid IN (${placeholders})`;
  await db.executeSql(query, uuidList);
}

