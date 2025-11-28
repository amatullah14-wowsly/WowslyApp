import { getDB } from "./index";

// -------------------- INSERT DOWNLOADED TICKETS --------------------
export async function saveTickets(tickets) {
  const db = getDB();
  const insertQuery = `
    INSERT OR REPLACE INTO tickets
    (event_id, guest_id, ticket_id, name, email, phone, qr_code, status, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `;

  const tx = await db.transaction();
  try {
    for (let t of tickets) {
      await tx.executeSql(insertQuery, [
        t.event_id,
        t.guest_id,
        t.ticket_id,
        t.name,
        t.email,
        t.phone,
        t.qr_code,
        t.status,
      ]);
    }
    await tx.commit();
  } catch (e) {
    console.log("SAVE TICKETS ERROR:", e);
    await tx.rollback();
  }
}

// -------------------- FIND TICKET BY QR --------------------
export async function getTicketByQR(qr) {
  const db = getDB();
  const res = await db.executeSql("SELECT * FROM tickets WHERE qr_code = ?", [qr]);
  return res[0].rows.length > 0 ? res[0].rows.item(0) : null;
}

// -------------------- STORE OFFLINE CHECK-IN --------------------
export async function saveOfflineCheckin(data) {
  const db = getDB();
  const query = `
    INSERT INTO checkins (event_id, guest_id, ticket_id, qr_code, scanned_at, synced)
    VALUES (?, ?, ?, ?, ?, 0)
  `;

  await db.executeSql(query, [
    data.event_id,
    data.guest_id,
    data.ticket_id,
    data.qr_code,
    data.scanned_at,
  ]);
}

// -------------------- GET UNSYNCED CHECKINS --------------------
export async function getUnsyncedCheckins() {
  const db = getDB();
  const res = await db.executeSql("SELECT * FROM checkins WHERE synced = 0");
  return res[0].rows.raw();
}

// -------------------- MARK CHECKINS AS SYNCED --------------------
export async function markTicketsAsSynced(qrList) {
  if (qrList.length === 0) return;
  const db = getDB();

  const placeholders = qrList.map(() => "?").join(",");
  const query = `UPDATE checkins SET synced = 1 WHERE qr_code IN (${placeholders})`;

  await db.executeSql(query, qrList);
}
