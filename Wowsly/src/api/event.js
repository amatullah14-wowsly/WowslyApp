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
            const response = await client.get(`/events?page=${page}&type=${type}&per_page=100`);
            const data = response.data;

            if (data && data.data && Array.isArray(data.data)) {
                events = [...events, ...data.data];

                if (data.data.length === 0 || data.next_page_url === null) {
                    hasMore = false;
                } else {
                    page++;
                }

                // Safety break
                if (page > 50) hasMore = false;
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.log(`Error fetching ${type} events page ${page}:`, error.message);
            hasMore = false;
        }
    }
    return events;
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

        console.log("Fetching all events (created + joined)...");

        const [createdEvents, joinedEvents] = await Promise.all([
            fetchEventsByType('created'),
            fetchEventsByType('join')
        ]);

        console.log(`Fetched ${createdEvents.length} created events and ${joinedEvents.length} joined events.`);

        // Merge and deduplicate based on ID
        const allEvents = [...createdEvents, ...joinedEvents];
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
        console.log("Fetching general list for QR codes...");
        let generalGuests = [];
        try {
            const url = `/events/${eventId}/eventuser?type=all&per_page=5000`;
            const response = await client.get(url);
            const data = response.data?.data || response.data || [];
            if (Array.isArray(data)) {
                generalGuests = data;
            }
        } catch (err) {
            console.log("General list fetch failed:", err.message);
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

import { getUnsyncedCheckins, markTicketsAsSynced } from '../db';
import { checkInGuest, syncOfflineCheckinsAPI } from './api';

export const syncPendingCheckins = async (eventId) => {
    try {
        console.log("Starting sync for event:", eventId);
        const unsynced = await getUnsyncedCheckins();
        console.log(`Found ${unsynced.length} unsynced check-ins`);

        if (unsynced.length === 0) {
            return { success: true, count: 0, message: "No pending check-ins to sync" };
        }

        let successCount = 0;
        let failCount = 0;

        for (const guest of unsynced) {
            try {
                const payload = {
                    event_id: parseInt(eventId),
                    guest_id: guest.guest_id,
                    ticket_id: guest.ticket_id || 0,
                    check_in_count: 1, // Defaulting to 1 as we don't track delta
                    category_check_in_count: "",
                    other_category_check_in_count: 0,
                    guest_facility_id: ""
                };

                console.log(`DEBUG: Syncing guest ${guest.guest_name} (ID: ${guest.guest_id}) - Payload:`, JSON.stringify(payload));

                const res = await checkInGuest(eventId, payload);

                // Check for success indicators (API might return object with id, or success: true)
                if (res && (res.id || res.check_in_time || res.success || res.status === true)) {
                    await markTicketsAsSynced([guest.qr_code]);
                    successCount++;
                } else {
                    console.warn(`Failed to sync guest ${guest.guest_name}:`, res);
                    failCount++;
                }
            } catch (err) {
                console.error(`Error syncing guest ${guest.guest_name}:`, err);
                failCount++;
            }
        }

        return {
            success: successCount > 0,
            count: successCount,
            failed: failCount,
            message: `Synced ${successCount} guests, ${failCount} failed`
        };

    } catch (error) {
        console.error("SYNC PENDING CHECKINS ERROR:", error);
        return { success: false, message: "Sync process failed" };
    }
};

export const getEventUsers = async (eventId, page = 1, type = 'all') => {
    try {
        const response = await client.get(`/events/${eventId}/eventuser?page=${page}&type=${type}&per_page=100`);
        return response.data;
    } catch (error) {
        console.log("GET EVENT USERS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const makeGuestManager = async (eventId, guestId) => {
    try {
        const response = await client.post(`/events/${eventId}/eventuser/${guestId}/make-manager`);
        return response.data;
    } catch (error) {
        console.log("MAKE MANAGER ERROR:", error.response?.data || error.message);
        return { status: false, message: "Failed to make manager" };
    }
};

export const makeGuestUser = async (eventId, guestId, type = 'registered') => {
    try {
        const response = await client.post(`/events/${eventId}/eventuser/${guestId}/make-guest`, { type });
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
        const response = await client.get(`/events/${eventId}/eventuser/${guestId}`);
        return response.data;
    } catch (error) {
        console.log("GET GUEST DETAILS ERROR:", error.response?.data || error.message);
        return { status: false, data: null };
    }
};
