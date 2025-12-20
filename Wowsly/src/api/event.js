import client from "./client";

// Cache for events list
let eventsCache = {
    data: null,
    timestamp: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchEventsByType = async (type) => {
    let events = [];
    let page = 1;
    let hasMore = true;

    console.log(`Fetching ${type} events...`);

    while (hasMore) {
        try {
            const url = `/events?page=${page}&type=${type}&per_page=100`;
            console.log(`Requesting: ${url}`);
            const response = await client.get(url);
            const data = response.data;

            // ⚡⚡⚡ DEBUG PAGINATION ⚡⚡⚡
            if (page === 1) {
                console.log("Pagination keys:", Object.keys(data));
                console.log("Next Page URL (root):", data.next_page_url);
                console.log("Next Page URL (links):", data.links?.next);
                console.log("Meta Total:", data.meta?.total);
            }

            if (data && data.data && Array.isArray(data.data)) {
                console.log(`Page ${page} received ${data.data.length} events.`);
                events = [...events, ...data.data];

                // Check for next page URL in root OR links.next
                const nextPageUrl = data.next_page_url || data.links?.next;
                const total = data.meta?.total || data.total;

                // ⚡⚡⚡ ROBUST PAGINATION LOGIC ⚡⚡⚡
                // Continue if:
                // 1. nextPageUrl exists
                // 2. OR we haven't fetched 'total' items yet (fallback for buggy API)
                const shouldContinue = nextPageUrl || (total && events.length < total);

                if (data.data.length === 0 || !shouldContinue) {
                    console.log("No more pages. Stopping.");
                    hasMore = false;
                } else {
                    console.log(`Moving to page ${page + 1} (Total: ${total}, Fetched: ${events.length})...`);
                    page++;
                }

                // Safety break
                if (page > 50) {
                    console.warn("Hit safety limit of 50 pages. Stopping.");
                    hasMore = false;
                }
            } else {
                console.warn("Invalid data structure received:", data);
                hasMore = false;
            }
        } catch (error) {
            console.log(`Error fetching ${type} events page ${page}:`, error.message);
            hasMore = false;
        }
    }
    console.log(`Total ${type} events fetched: ${events.length}`);
    return events;
};

// ⚡⚡⚡ NEW: Fetch single page for incremental loading ⚡⚡⚡
export const getEventsPage = async (page = 1, type = 'created') => {
    try {
        const url = `/events?page=${page}&type=${type}&per_page=100`;
        console.log(`fetching events page ${page}...`);
        const response = await client.get(url);
        return response.data; // { data: [...], next_page_url: ..., meta: ... }
    } catch (error) {
        console.log(`PAGE ${page} ERROR:`, error.message);
        return { data: [], next_page_url: null };
    }
};

export const getEvents = async (forceRefresh = false) => {
    try {
        const now = Date.now();

        if (
            !forceRefresh &&
            eventsCache.data &&
            now - eventsCache.timestamp < CACHE_DURATION
        ) {
            console.log("Returning cached events");
            return eventsCache.data;
        }

        console.log("Fetching created events only...");

        // ⚡⚡⚡ USER REQUEST: ONLY FETCH CREATED EVENTS ⚡⚡⚡
        const createdEvents = await fetchEventsByType('created');
        const joinedEvents = []; // Empty for now as per request

        console.log(`Fetched ${createdEvents.length} created events.`);

        // Merge and deduplicate based on ID
        const allEvents = [...createdEvents];
        const uniqueEvents = [];
        const seenIds = new Set();

        for (const event of allEvents) {
            if (!seenIds.has(event.id)) {
                seenIds.add(event.id);
                uniqueEvents.push(event);
            }
        }

        // Sort by start_date descending (newest first) - optional but good for UX
        uniqueEvents.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

        console.log(`Total unique events: ${uniqueEvents.length}`);

        // Update cache
        eventsCache = {
            data: { data: uniqueEvents },
            timestamp: now,
        };

        return { data: uniqueEvents };
    } catch (error) {
        console.log("GET EVENTS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const getEventDetails = async (id) => {
    try {
        const response = await client.get(`/events/${id}`);
        return response.data;
    } catch (error) {
        console.log("GET EVENT DETAILS ERROR:", error.response?.data || error.message);
        return { status: false, data: null };
    }
};

export const downloadOfflineData = async (eventId) => {
    try {
        console.log("Starting offline data download for event:", eventId);

        // 1. Fetch Ticket List
        const ticketListRes = await getTicketList(eventId);
        const tickets = ticketListRes?.data || [];
        console.log(`Found ${tickets.length} ticket types.`);

        // 2. Fetch Users per Ticket (to get accurate tickets_bought count)
        let allGuests = [];

        for (const ticket of tickets) {
            try {
                const eventType = (ticket.type || 'paid').toLowerCase();
                console.log(`Fetching users for ticket: ${ticket.title} (${ticket.id}) type: ${eventType}`);

                const soldRes = await getTicketSoldUsers(eventId, ticket.id, eventType);

                let soldUsers = [];
                if (Array.isArray(soldRes)) {
                    soldUsers = soldRes;
                } else if (soldRes && Array.isArray(soldRes.data)) {
                    soldUsers = soldRes.data;
                } else if (soldRes && soldRes.data && Array.isArray(soldRes.data.data)) {
                    soldUsers = soldRes.data.data;
                }

                if (Array.isArray(soldUsers) && soldUsers.length > 0) {
                    const enrichedUsers = soldUsers.map(u => ({
                        ...u,
                        ticket_id: ticket.id,
                        ticket_title: ticket.title,
                    }));
                    allGuests = [...allGuests, ...enrichedUsers];
                }
            } catch (err) {
                console.log(`Failed to fetch users for ticket ${ticket.id}:`, err.message);
            }
        }

        // ⚡⚡⚡ AGGREGATE DUPLICATES (Sum tickets_bought) ⚡⚡⚡
        const guestMap = new Map();

        for (const g of allGuests) {
            const uniqueId = g.qr_code || g.uuid || g.id || g.user_id || g.mobile;
            if (!uniqueId) continue;

            if (guestMap.has(uniqueId)) {
                const existing = guestMap.get(uniqueId);
                const currentCount = existing.tickets_bought || 1;
                const incomingCount = g.tickets_bought || g.quantity || g.total_pax || g.pax || g.total_entries || 1;
                existing.tickets_bought = currentCount + incomingCount;
            } else {
                g.tickets_bought = g.tickets_bought || g.quantity || g.total_pax || g.pax || g.total_entries || 1;
                guestMap.set(uniqueId, g);
            }
        }

        const uniqueGuests = Array.from(guestMap.values());
        console.log(`Total unique guests fetched via tickets: ${uniqueGuests.length}`);

        // ⚡⚡⚡ MERGE STRATEGY ⚡⚡⚡
        // 1. Ticket-based fetch: Good for 'tickets_bought' count, but often misses 'uuid' (QR).
        // 2. General list fetch: Good for 'uuid' (QR), but often misses 'tickets_bought'.
        // SOLUTION: Fetch BOTH and merge by MOBILE number.

        // A. Create Map from Ticket-Based Data (Mobile -> TicketInfo)
        const ticketInfoMap = new Map();

        for (const g of uniqueGuests) {
            if (g.mobile) {
                const mobile = String(g.mobile).trim();
                ticketInfoMap.set(mobile, {
                    count: g.tickets_bought || g.quantity || 1,
                    ticket_id: g.ticket_id,
                    ticket_title: g.ticket_title
                });
            }
        }
        console.log(`DEBUG: Populated ticket info map with ${ticketInfoMap.size} entries.`);

        // B. Fetch General List (Primary source for QR/UUID)
        console.log("Fetching general list via /eventuser/fetch...");
        let generalGuests = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                console.log(`Fetching guest list page ${page}...`);
                const res = await client.get(`/events/${eventId}/eventuser/fetch?page=${page}`);
                const data = res.data;

                if (data && data.guests_list && Array.isArray(data.guests_list)) {
                    console.log(`Page ${page} received ${data.guests_list.length} guests.`);
                    generalGuests = [...generalGuests, ...data.guests_list];

                    // Check for next page
                    // Stop if empty list OR current_page >= last_page
                    if (data.guests_list.length === 0 || (data.meta && data.meta.current_page >= data.meta.last_page)) {
                        hasMore = false;
                    } else {
                        page++;
                    }

                    // Safety break
                    if (page > 50) hasMore = false;
                } else {
                    console.warn("Invalid guest list structure:", data);
                    hasMore = false;
                }
            } catch (err) {
                console.error(`Error fetching guest list page ${page}:`, err.message);
                hasMore = false;
            }
        }

        console.log(`DEBUG: Fetched ${generalGuests.length} guests from general list.`);

        // C. Merge
        const mergedGuests = generalGuests.map(g => {
            const mobile = g.mobile ? String(g.mobile).trim() : null;
            let count = 1;
            let ticketId = g.ticket_id; // Preserve if already exists
            let ticketTitle = g.ticket_title;

            if (mobile && ticketInfoMap.has(mobile)) {
                const info = ticketInfoMap.get(mobile);
                count = info.count;
                ticketId = info.ticket_id; // Get Ticket Type ID (e.g. 4292)
                ticketTitle = info.ticket_title;
                console.log(`DEBUG: Merged ${g.name} (Mobile: ${mobile}) -> Tickets: ${count}, ID: ${ticketId}`);
            } else {
                // Fallback: check if the guest object itself has it (rare but possible)
                count = g.tickets_bought || g.quantity || g.total_pax || g.pax || g.total_entries || 1;
            }

            return {
                ...g,
                tickets_bought: count, // Ensure this field is set for DB
                total_entries: count,   // Explicitly set for DB mapping
                ticket_id: ticketId,    // ⚡⚡⚡ Ensure Ticket Type ID is set ⚡⚡⚡
                ticket_title: ticketTitle
            };
        });

        if (mergedGuests.length > 0) {
            console.log("DEBUG: Sample Merged Guest:", JSON.stringify(mergedGuests[0]));
        }

        return {
            guests_list: mergedGuests
        };

    } catch (error) {
        console.log(
            "DOWNLOAD OFFLINE DATA ERROR:",
            error.response?.data || error.message
        );
        return { status: false, message: "Download failed" };
    }
};

export const getTicketList = async (eventId) => {
    try {
        console.log('Fetching ticket list for event:', eventId);
        const response = await client.get(`/events/${eventId}/ticket-list`);
        console.log('Ticket list response:', response.data);
        return response.data;
    } catch (error) {
        console.log(
            "TICKET LIST API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: [] };
    }
};

export const getTicketSoldUsers = async (eventId, ticketId, eventType = 'paid') => {
    try {
        console.log(`DEBUG: getTicketSoldUsers calling for event ${eventId}, ticket ${ticketId}, type ${eventType}`);
        const response = await client.get(`/events/${eventId}/ticket/${ticketId}/sold`, {
            params: {
                event_type: eventType,
                ticket_id: ticketId
            }
        });
        console.log(`DEBUG: getTicketSoldUsers response for ${ticketId}:`, response.data ? (Array.isArray(response.data.data) ? response.data.data.length : 'Not array') : 'No data');
        return response.data;
    } catch (error) {
        console.log("GET TICKET SOLD USERS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

import { getUnsyncedCheckins, markTicketsAsSynced, getUnsyncedFacilities, markFacilitiesAsSynced } from '../db';
import { checkInGuest, syncOfflineCheckinsAPI } from './api';

export const syncPendingCheckins = async (eventId) => {
    try {
        console.log("Starting sync for event:", eventId);
        const unsyncedGuests = await getUnsyncedCheckins(eventId);
        const unsyncedFacilities = await getUnsyncedFacilities(eventId);

        console.log(`Found ${unsyncedGuests.length} unsynced guests and ${unsyncedFacilities.length} unsynced facilities`);

        if (unsyncedGuests.length === 0 && unsyncedFacilities.length === 0) {
            return { success: true, count: 0, message: "No pending check-ins to sync" };
        }

        // ⚡⚡⚡ MERGE GUESTS AND FACILITIES ⚡⚡⚡
        const payloadMap = new Map();
        const facilityIdsToSync = [];
        const qrCodesToSync = [];

        // 1. Add Guests
        unsyncedGuests.forEach(g => {
            const uuid = g.qrGuestUuid || g.qr_code;
            qrCodesToSync.push(g.qr_code); // Track for marking synced

            payloadMap.set(uuid, {
                qrGuestUuid: uuid,
                check_in_count: parseInt(g.check_in_count || g.used_entries || 0), // total offline main check-ins
                ticket_id: parseInt(g.qrTicketId || g.ticket_id || 0),
                // Kotlin expects Long epoch millis
                check_in_time: g.given_check_in_time
                    ? new Date(g.given_check_in_time).getTime()
                    : (g.checkInTime || Date.now()),
                facility_checkIn_count: []
            });
        });

        // 2. Add Facilities
        // Group unsynced facilities by guest_uuid first
        const facilitiesByGuest = {};

        unsyncedFacilities.forEach(f => {
            const uuid = f.guest_uuid;
            facilityIdsToSync.push(f.id); // Track for marking synced

            if (!facilitiesByGuest[uuid]) {
                facilitiesByGuest[uuid] = [];
            }
            facilitiesByGuest[uuid].push(f);
        });

        // Now process groups
        Object.keys(facilitiesByGuest).forEach(uuid => {
            const facilities = facilitiesByGuest[uuid];

            if (!payloadMap.has(uuid)) {
                payloadMap.set(uuid, {
                    qrGuestUuid: uuid,
                    check_in_count: 0, // ⚡⚡⚡ FIX: 0 here avoids incrementing main ticket count if only syncing facilities
                    ticket_id: facilities[0]?.ticket_id || 0,
                    check_in_time: new Date().toISOString(),
                    facility_checkIn_count: []
                });
            }

            const entry = payloadMap.get(uuid);

            entry.facility_checkIn_count = facilities.map(f => ({
                id: f.facilityId,
                checkIn_count: f.checkIn || 0
            }));
        });

        const bulkPayload = Array.from(payloadMap.values());

        console.log(`DEBUG: Sending bulk sync for ${bulkPayload.length} unique guests`);
        if (bulkPayload.length > 0) {
            console.log("DEBUG: Bulk Payload Sample:", JSON.stringify(bulkPayload[0]));
        }

        const res = await syncOfflineCheckinsAPI(eventId, bulkPayload);
        console.log("Bulk sync response:", JSON.stringify(res));

        if (res && (res.success || res.status === true || res.message === "Check-in successful")) {
            // Mark all as synced
            if (qrCodesToSync.length > 0) await markTicketsAsSynced(qrCodesToSync);
            if (facilityIdsToSync.length > 0) await markFacilitiesAsSynced(facilityIdsToSync);

            // Return counts
            const totalUpdated = qrCodesToSync.length + facilityIdsToSync.length;

            return {
                success: true,
                count: totalUpdated,
                message: `Synced ${totalUpdated} items successfully`
            };
        } else {
            console.warn("Bulk sync failed:", res);
            return {
                success: false,
                message: res?.message || "Bulk sync failed"
            };
        }

    } catch (error) {
        console.error("SYNC PENDING CHECKINS ERROR:", error);
        return { success: false, message: "Sync process failed" };
    }
};

// ⚡⚡⚡ CORRECTED ENDPOINT PER USER INPUT ⚡⚡⚡
export const makeGuestUser = async (eventId, guestId, type = 'registered') => {
    try {
        console.log(`Making guest ${guestId} a guest via generic update endpoint...`);
        // Payload: {_method: "PUT", role: "guest"}
        // Endpoint: /events/:eventId/eventuser/:eventUserId
        // Note: 'type' param might not be needed if 'role' handles it, but keeping signature compatible
        const response = await client.post(`/events/${eventId}/eventuser/${guestId}`, {
            _method: 'PUT',
            role: 'guest'
        });
        return response.data;
    } catch (error) {
        console.log("MAKE GUEST ERROR:", error.response?.data || error.message);
        return { status: false, message: "Failed to make guest" };
    }
};

export const getCheckinDistribution = async (eventId) => {
    try {
        const response = await client.get(`/events/${eventId}/checkin/tickets`);
        return response.data;
    } catch (error) {
        console.log("GET CHECKIN DISTRIBUTION ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const getGuestDetails = async (eventId, guestId) => {
    try {
        const url = `/events/${eventId}/eventuser/getguestdetails?event_user_id=${guestId}`;
        console.log("DEBUG: getGuestDetails Requesting:", url);
        const response = await client.get(url);
        console.log("DEBUG: getGuestDetails Response:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET GUEST DETAILS ERROR:", error.response?.data || error.message);
        return { status: false, data: null };
    }
};

export const getEventUsers = async (eventId, page = 1, type = 'all') => {
    try {
        let allGuests = [];
        let currentPage = page;
        let hasMore = true;

        console.log(`Fetching ALL event users starting from page ${currentPage}...`);

        while (hasMore) {
            // ⚡⚡⚡ UPDATED ENDPOINT: /eventuser/fetch ⚡⚡⚡
            const url = `/events/${eventId}/eventuser/fetch?page=${currentPage}&type=${type}&per_page=50`;
            console.log(`Requesting: ${url}`);
            const response = await client.get(url);
            const data = response.data;

            // Handle "guests_list" structure (from /fetch endpoint)
            if (data && data.guests_list && Array.isArray(data.guests_list)) {
                allGuests = [...allGuests, ...data.guests_list];
                console.log(`Page ${currentPage} fetched ${data.guests_list.length} guests. Total so far: ${allGuests.length}`);

                // Check pagination
                if (data.guests_list.length === 0 || (data.meta && data.meta.current_page >= data.meta.last_page)) {
                    hasMore = false;
                } else {
                    currentPage++;
                }

                // Safety break
                if (currentPage > 50) hasMore = false;

            } else if (data && data.data && Array.isArray(data.data)) {
                // Fallback for standard structure
                allGuests = [...allGuests, ...data.data];
                console.log(`Page ${currentPage} fetched ${data.data.length} guests. Total so far: ${allGuests.length}`);

                if (data.data.length === 0 || !data.next_page_url) {
                    hasMore = false;
                } else {
                    currentPage++;
                }
                if (currentPage > 50) hasMore = false;

            } else {
                // Handle direct array
                if (Array.isArray(data)) {
                    allGuests = [...allGuests, ...data];
                    console.log(`Page ${currentPage} (Direct Array) fetched ${data.length} guests.`);

                    if (data.length < 50) {
                        hasMore = false;
                    } else {
                        currentPage++;
                    }
                } else {
                    hasMore = false;
                }
            }
        }

        console.log(`Total guests fetched: ${allGuests.length}`);
        return { data: allGuests };

    } catch (error) {
        console.log("GET EVENT USERS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const getEventUsersPage = async (eventId, page = 1, type = 'all', search = '') => {
    try {
        let url = `/events/${eventId}/eventuser/fetch?page=${page}&type=${type}&per_page=100`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }

        console.log(`Requesting Page: ${url}`);
        const response = await client.get(url);
        return response.data; // Should return { guests_list: [], meta: { current_page, last_page, total, ... } }
    } catch (error) {
        console.log("GET EVENT USERS PAGE ERROR:", error.response?.data || error.message);
        return { status: false, guests_list: [], meta: null };
    }
};

// ⚡⚡⚡ CORRECTED ENDPOINT PER USER INPUT ⚡⚡⚡
export const makeGuestManager = async (eventId, guestId) => {
    try {
        console.log(`Making guest ${guestId} a manager via generic update endpoint...`);
        // Payload: {_method: "PUT", role: "manager"}
        // Endpoint: /events/:eventId/eventuser/:eventUserId
        const response = await client.post(`/events/${eventId}/eventuser/${guestId}`, {
            _method: 'PUT',
            role: 'manager'
        });
        return response.data;
    } catch (error) {
        console.log("MAKE MANAGER ERROR:", error.response?.data || error.message);
        return { status: false, message: "Failed to make manager" };
    }
};

export const verifyQrCode = async (eventId, payload) => {
    try {
        console.log(`Verifying QR code for event ${eventId} with payload:`, payload);
        const response = await client.post(`/events/${eventId}/eventuser/verifyqrcode`, payload);
        console.log("VERIFY QR RESPONSE:", response.data);
        return response.data;
    } catch (error) {
        console.log("VERIFY QR ERROR:", error.response?.data || error.message);
        return { status: false, message: "Verification failed" };
    }
};

export const checkInEventUser = async (eventId, payload) => {
    try {
        console.log(`CheckCheck-in Event User for event ${eventId} with payload:`, payload);
        const response = await client.post(`/events/${eventId}/eventuser/checkin`, payload);
        console.log("CHECK-IN EVENT USER RESPONSE:", response.data);
        return response.data;
    } catch (error) {
        console.log("CHECK-IN EVENT USER ERROR:", error.response?.data || error.message);
        return { status: false, message: "Check-in failed" };
    }
};

export const getEventTickets = async (eventId) => {
    try {
        console.log(`Fetching Event Tickets (with facilities) for event: ${eventId}`);
        const response = await client.get(`/events/${eventId}/eventticket`);
        // console.log("EVENT TICKETS RESPONSE:", response.data);
        return response.data;
    } catch (error) {
        console.log("GET EVENT TICKETS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const manualCheckInGuest = async (eventId, payload) => {
    try {
        console.log(`Manual Check-in for event ${eventId} with payload:`, payload);
        // Payload expected: { guest_id: string, quantity: number }
        const response = await client.post(`/events/${eventId}/eventticket`, payload);
        console.log("MANUAL CHECK-IN RESPONSE:", response.data);
        return response.data;
    } catch (error) {
        console.log("MANUAL CHECK-IN ERROR:", error.response?.data || error.message);
        return { status: false, message: "Manual check-in failed" };
    }
};

export const getEventTicketCheckins = async (eventId) => {
    try {
        console.log(`Fetching Ticket Check-in Stats for event: ${eventId}`);
        const response = await client.get(`/events/${eventId}/checkin/tickets`);
        console.log("TICKET CHECK-IN STATS RESPONSE:", response.data);
        return response.data;
    } catch (error) {
        console.log("GET TICKET CHECK-IN STATS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const verifyQrAndCheckin = async (eventId, payload) => {
    try {
        const checkins = Array.isArray(payload) ? payload : [payload];
        const fixedPayload = checkins.map(item => ({
            event_user_id: item.event_user_id, // Added event_user_id
            qrGuestUuid: item.qrGuestUuid,
            ticket_id: item.qrTicketId || item.ticket_id,
            check_in_count: item.check_in_count,
            check_in_time: new Date(item.checkInTime || item.check_in_time || Date.now()).toISOString(),
            facility_checkin: item.facility_checkIn_count?.map(f => ({
                facility_id: f.id,
                check_in_count: f.checkIn_count
            }))
        }));

        console.log(`Verifying QR and Checking in for event ${eventId} with mapped payload:`, JSON.stringify(fixedPayload));
        const response = await client.post(`/events/${eventId}/eventuser/verifyqrandcheckin`, fixedPayload);
        console.log("VERIFY QR AND CHECKIN RESPONSE:", response.data);
        return response.data;
    } catch (error) {
        console.log("VERIFY QR AND CHECKIN ERROR:", error.response?.data || error.message);
        return { status: false, message: "Verify and Check-in failed" };
    }
};

export const getTicketCheckInRecords = async (eventId, ticketId, page = 1) => {
    try {
        console.log(`Fetching Ticket Check-in Records for event: ${eventId}, ticket: ${ticketId}, page: ${page}`);
        const response = await client.get(`/events/${eventId}/ticket/${ticketId}/checkin/records?page=${page}`);
        // console.log("TICKET CHECK-IN RECORDS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET TICKET CHECK-IN RECORDS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const downloadTicketCsv = async (eventId, ticketId) => {
    try {
        console.log(`Downloading CSV for event: ${eventId}, ticket: ${ticketId}`);
        // Response type arraybuffer/blob is usually needed for files, but if it returns text/csv string, default is fine.
        // User sample response looks like text string.
        const response = await client.get(`/events/${eventId}/ticket/${ticketId}/checkin/records/download`);
        console.log("DOWNLOAD CSV RESPONSE Length:", response.data?.length || 0);
        return response.data;
    } catch (error) {
        console.log("DOWNLOAD CSV ERROR:", error.response?.data || error.message);
        return null;
    }
};

export const getTicketCheckInCount = async (eventId, ticketId) => {
    try {
        console.log(`Fetching Ticket Check-in Count for event: ${eventId}, ticket: ${ticketId}`);
        const response = await client.get(`/events/${eventId}/ticket/${ticketId}/checkin/records/count`);
        console.log("TICKET CHECK-IN COUNT RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET TICKET CHECK-IN COUNT ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const getRegistrationAnswers = async (eventId, page = 1) => {
    try {
        console.log(`Fetching Registration Answers for event: ${eventId}, page: ${page}`);
        const response = await client.get(`/events/${eventId}/registrationform/answer?page=${page}&current_timezone=Asia%2FCalcutta`);
        // console.log("REGISTRATION ANSWERS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET REGISTRATION ANSWERS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const exportRegistrationReplies = async (eventId, startDate = null, endDate = null) => {
    try {
        console.log(`Exporting Registration Replies for event: ${eventId}, dates: ${startDate} to ${endDate}`);

        let url = `/events/${eventId}/registrationform/replies/download?current_timezone=Asia%2FCalcutta`;

        if (startDate && endDate) {
            // Append date params as requested
            // Format assumed to be YYYY-MM-DD based on user input, or we format it.
            // User example: start_date=2025-12-06&start_time=00:00:00
            url += `&start_date=${startDate}&start_time=00:00:00&end_date=${endDate}&end_time=23:59:59`;
        }

        console.log("Export URL:", url);
        const response = await client.get(url);
        console.log("EXPORT REGISTRATION REPLIES RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("EXPORT REGISTRATION REPLIES ERROR:", error.response?.data || error.message);
        return { success: false, message: "Export failed" };
    }
};

export const getExportStatus = async (eventId) => {
    try {
        console.log(`Checking Export Status for event: ${eventId}`);
        const response = await client.get(`/events/${eventId}/registrationform/replies/status?current_timezone=Asia%2FCalcutta`);
        console.log("EXPORT STATUS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET EXPORT STATUS ERROR:", error.response?.data || error.message);
        return { success: false, status: "failed" };
    }
};

export const insertOrUpdateRegistrationForm = async (eventId, formId, payload) => {
    try {
        console.log(`Insert or Update Registration Form for event: ${eventId}, form: ${formId}`);
        const response = await client.post(`/events/${eventId}/eventregistrationformfields/${formId}/insertorupdate`, payload);
        console.log("INSERT/UPDATE FORM RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("INSERT/UPDATE FORM ERROR:", error.response?.data || error.message);
        return { success: false, message: "Save failed" };
    }
};

export const deleteRegistrationFormFields = async (eventId, payload) => {
    try {
        console.log(`Bulk Delete Form Fields for event: ${eventId}`, payload);
        const response = await client.post(`/events/${eventId}/eventregistrationformfields/bulkdelete`, payload);
        console.log("BULK DELETE FIELDS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("BULK DELETE FIELDS ERROR:", error.response?.data || error.message);
        return { success: false, message: "Delete failed" };
    }
};

export const getRegistrationFormStatus = async (eventId) => {
    try {
        console.log(`Checking Registration Form Status for event: ${eventId}`);
        const response = await client.get(`/events/${eventId}/eventregistrationforms`);
        console.log("GET REGISTRATION FORM STATUS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET REGISTRATION FORM STATUS ERROR:", error.response?.data || error.message);
        return { is_filled: false, form: [] };
    }
};

export const createRegistrationForm = async (eventId, payload) => {
    try {
        console.log(`Creating Registration Form for event: ${eventId}`);
        const response = await client.post(`/events/${eventId}/eventregistrationforms`, payload);
        console.log("CREATE REGISTRATION FORM RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("CREATE REGISTRATION FORM ERROR:", error.response?.data || error.message);
        return { success: false, message: "Creation failed" };
    }
};

export const updateGuestStatus = async (eventId, guestId, status) => {
    try {
        console.log(`Updating Guest Status for event: ${eventId}, guest: ${guestId}, status: ${status}`);
        const response = await client.put(`/events/${eventId}/guests/${guestId}/status`, { approval_status: status });
        console.log("UPDATE GUEST STATUS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("UPDATE GUEST STATUS ERROR:", error.response?.data || error.message);
        return { success: false, message: "Status update failed" };
    }
};

export const getRegistrationFormDetails = async (eventId, formId) => {
    try {
        console.log(`Get Registration Form Details for event: ${eventId}, form: ${formId}`);
        const response = await client.get(`/events/${eventId}/eventregistrationforms/${formId}`);
        console.log("GET FORM DETAILS RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET FORM DETAILS ERROR:", error.response?.data || error.message);
        return { success: false, message: "Fetch failed" };
    }
};

export const getEventWebLink = async (guestUuid) => {
    try {
        console.log(`Getting Event Link via guest UUID: ${guestUuid}`);
        const response = await client.get(`/event/weblink?guest_uuid=${guestUuid}`);
        // console.log("GET EVENT WEBLINK RESPONSE:", JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.log("GET EVENT WEBLINK ERROR:", error.response?.data || error.message);
        return { status: false, message: "Fetch failed" };
    }
};
