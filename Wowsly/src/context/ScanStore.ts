import { DeviceEventEmitter } from 'react-native';

// Global in-memory store for recent scans
// Maps guestId -> { used_entries, total_entries, status, timestamp }
export const scanStore: Record<string, any> = {};

// Initialize listener to keep store updated
export const initScanStore = () => {
    DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', (data) => {
        console.log("ScanStore received broadcast:", JSON.stringify(data));
        if (data && (data.guestId || data.guest_id)) {
            const gId = (data.guestId || data.guest_id).toString();
            scanStore[gId] = {
                used_entries: data.usedEntries || data.used_entries,
                total_entries: data.totalEntries || data.total_entries,
                status: 'Checked In',
                timestamp: Date.now()
            };
            console.log(`ScanStore updated for guest ${gId}:`, scanStore[gId]);
        } else {
            console.warn("ScanStore received invalid data (missing guestId):", data);
        }
    });
};

// Helper to get merged guest data
export const getMergedGuest = (guest: any) => {
    const gId = guest.id?.toString();
    if (scanStore[gId]) {
        const local = scanStore[gId];
        // Use local if it has more used entries (handling API lag)
        if ((local.used_entries || 0) > (guest.checked_in_count || guest.used_entries || 0)) {
            return {
                ...guest,
                used_entries: local.used_entries,
                checked_in_count: local.used_entries,
                total_entries: local.total_entries || guest.total_entries,
                status: local.status
            };
        }
    }
    return guest;
};
