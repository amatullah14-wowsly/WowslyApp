/* src/sync/syncService.ts */
import NetInfo from "@react-native-community/netinfo";
import { initDB, getUnsyncedCheckins, markTicketsAsSynced } from "../db";
import { syncOfflineCheckinsAPI } from "../api/api";

export async function performSyncIfOnline() {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    console.log("No internet connection, skipping sync");
    return;
  }

  await initDB();
  const unsynced = await getUnsyncedCheckins();
  if (!unsynced || unsynced.length === 0) {
    console.log("No unsynced check-ins to sync");
    return;
  }

  const payload = unsynced.map(u => ({
    event_id: u.event_id,
    guest_id: u.guest_id,
    ticket_id: u.ticket_id,
    qr_code: u.qr_code,
    scanned_at: u.scanned_at,
  }));

  try {
    console.log(`Syncing ${payload.length} offline check-ins...`);
    const resp = await syncOfflineCheckinsAPI(payload);

    if (resp?.success === true || resp?.status === true) {
      const qrList = unsynced.map(s => s.qr_code);
      await markTicketsAsSynced(qrList);
      console.log(`Sync success! Marked ${qrList.length} check-ins as synced`);
    } else {
      console.warn("Sync: server returned non-success", resp);
    }
  } catch (err) {
    console.error("Sync failed:", err);
  }
}
