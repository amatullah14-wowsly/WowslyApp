/* src/sync/syncService.ts */

import NetInfo from "@react-native-community/netinfo";
import {
  initDB,
  getAllUnsyncedCheckins,
  markTicketsAsSynced,
  getUnsyncedFacilities,
  markFacilitiesAsSynced
} from "../db";
import {
  syncOfflineCheckinsAPI,
  syncFacilitiesAPI
} from "../api/api";

/**
 * Sync flow:
 * 1) Sync ticket-level check-ins
 * 2) Sync facility-level check-ins
 * Uses ABSOLUTE COUNTS (not increments)
 * Matches Kotlin behavior 1:1
 */

// --------------------------------------------
// MAIN SYNC FUNCTION
// --------------------------------------------
export async function performSyncIfOnline(eventIds: number[] = []) {
  const state = await NetInfo.fetch();

  if (!state.isConnected) {
    console.log("🔌 Offline — skipping sync");
    return;
  }

  await initDB();

  // ======================================================
  // 1️⃣ SYNC TICKET-LEVEL CHECKINS
  // ======================================================
  try {
    const unsyncedCheckins = await getAllUnsyncedCheckins();

    if (!unsyncedCheckins || unsyncedCheckins.length === 0) {
      console.log("✅ No unsynced ticket check-ins");
    } else {
      const payload = unsyncedCheckins.map((u: any) => ({
        event_id: u.event_id,
        qrGuestUuid: u.qrGuestUuid || u.qr_code,
        ticket_id: u.qrTicketId || u.ticket_id,
        check_in_count: u.check_in_count || u.used_entries || 1,
        check_in_time:
          u.given_check_in_time ||
          u.scanned_at ||
          new Date().toISOString(),
        guest_id: u.guest_id || null
      }));

      console.log(
        "📤 SYNC TICKET PAYLOAD",
        JSON.stringify(payload, null, 2)
      );

      const resp = await syncOfflineCheckinsAPI(payload);

      if (resp?.success === true || resp?.status === true) {
        const qrCodes = unsyncedCheckins
          .map((u: any) => u.qrGuestUuid || u.qr_code)
          .filter(Boolean);

        await markTicketsAsSynced(qrCodes);
        console.log(`✅ Ticket sync success (${qrCodes.length})`);
      } else {
        console.warn("❌ Ticket sync failed", resp);
      }
    }
  } catch (err) {
    console.error("🔥 Ticket sync error:", err);
  }

  // ======================================================
  // 2️⃣ SYNC FACILITY-LEVEL CHECKINS
  // ======================================================
  try {
    if (!eventIds.length) {
      console.warn("⚠️ No eventIds provided — skipping facility sync");
      return;
    }

    for (const eventId of eventIds) {
      const facilities = await getUnsyncedFacilities(eventId);

      if (!facilities || facilities.length === 0) {
        console.log(`✅ No unsynced facilities for event ${eventId}`);
        continue;
      }

      /**
       * 🚨 IMPORTANT
       * We send ABSOLUTE counts
       * NOT increments
       * EXACT Kotlin behavior
       */
      const payload = facilities.map((f: any) => ({
        event_id: f.eventId,
        guest_uuid: f.guest_uuid,
        ticket_id: f.ticket_id || null,
        facility_id: f.facilityId,
        check_in_count: f.checkIn // ✅ ACTUAL USED COUNT
      }));

      console.log(
        "📤 SYNC FACILITY PAYLOAD",
        JSON.stringify(payload, null, 2)
      );

      const resp = await syncFacilitiesAPI(payload);

      // ✅ THIS IS WHERE YOUR LINE BELONGS
      if (resp?.success === true || resp?.status === true) {
        const facilityIdsToSync = facilities.map((f: any) => f.id);
        await markFacilitiesAsSynced(facilityIdsToSync);

        console.log(
          `✅ Facility sync success for event ${eventId} (${facilityIdsToSync.length})`
        );
      } else {
        console.warn(
          `❌ Facility sync failed for event ${eventId}`,
          resp
        );
      }
    }
  } catch (err) {
    console.error("🔥 Facility sync error:", err);
  }
}
