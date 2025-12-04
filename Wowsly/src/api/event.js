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

export const getEventUsers = async (id, page = 1, type = 'all') => {
    try {
        const response = await client.get(`/events/${id}/eventuser?page=${page}&type=${type}`);
        return response.data;
    } catch (error) {
        console.log("GET EVENT USERS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};

export const getGuestDetails = async (eventId, guestId) => {
    try {
        const response = await client.get(`/events/${eventId}/eventuser/getguestdetails?event_user_id=${guestId}`);
        return response.data;
    } catch (error) {
        console.log("GET GUEST DETAILS ERROR:", error.response?.data || error.message);
        return { status: false, data: null };
    }
};

export const downloadOfflineData = async (eventId) => {
    try {
        console.log("Downloading offline data via Ticket List strategy...");

        // 1. Get Ticket List
        const ticketListRes = await getTicketList(eventId);
        const tickets = ticketListRes?.data || [];

        if (!tickets.length) {
            // Fallback to simple eventuser list if no tickets found
            console.log("No tickets found, falling back to simple eventuser list");
            const url = `/events/${eventId}/eventuser?type=all&per_page=5000`;
            const response = await client.get(url);
            const guests = response.data?.data || response.data || [];
            return { guests_list: Array.isArray(guests) ? guests : [] };
        }

        let allGuests = [];

        // 2. Fetch users for each ticket
        for (const ticket of tickets) {
            try {
                // Determine event type (free/paid) based on ticket type or default
                // The API seems to expect 'paid' or 'free'. 
                // ticket.type might be 'FREE' or 'PAID' or 'DONATION'
                const eventType = (ticket.type || 'paid').toLowerCase();

                console.log(`Fetching users for ticket: ${ticket.title} (${ticket.id}) type: ${eventType}`);

                const soldRes = await getTicketSoldUsers(eventId, ticket.id, eventType);

                // ⚡⚡⚡ IMPROVED EXTRACTION & LOGGING ⚡⚡⚡
                let soldUsers = [];
                if (Array.isArray(soldRes)) {
                    soldUsers = soldRes;
                } else if (soldRes && Array.isArray(soldRes.data)) {
                    soldUsers = soldRes.data;
                } else if (soldRes && soldRes.data && Array.isArray(soldRes.data.data)) {
                    // Handle nested pagination structure { data: { data: [...] } }
                    soldUsers = soldRes.data.data;
                }

                console.log(`DEBUG: Ticket ${ticket.id} raw response keys:`, Object.keys(soldRes || {}));
                console.log(`DEBUG: Extracted ${soldUsers.length} soldUsers for ticket ${ticket.id}`);

                if (Array.isArray(soldUsers) && soldUsers.length > 0) {
                    console.log(`DEBUG: Fetched ${soldUsers.length} users for ticket ${ticket.id}. Sample User:`, JSON.stringify(soldUsers[0]));
                    console.log(`DEBUG: Sample User tickets_bought: ${soldUsers[0].tickets_bought}, quantity: ${soldUsers[0].quantity}`);
                    // Enrich users with ticket info if missing
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
            // Try to find a unique ID
            // Fallback to mobile number if QR/UUID is missing (common in some API responses)
            const uniqueId = g.qr_code || g.uuid || g.id || g.user_id || g.mobile;

            if (!uniqueId) {
                // Only warn if absolutely no identifier is found
                // console.warn("Skipping guest without unique ID:", g.name);
                continue;
            }

            if (guestMap.has(uniqueId)) {
                const existing = guestMap.get(uniqueId);
                // Increment count (assuming each row is 1 ticket unless specified)
                const currentCount = existing.tickets_bought || 1;
                const incomingCount = g.tickets_bought || g.quantity || g.total_pax || g.pax || g.total_entries || 1;
                existing.tickets_bought = currentCount + incomingCount;

                // Keep the one with more info if possible (optional optimization)
            } else {
                // Initialize tickets_bought if missing
                g.tickets_bought = g.tickets_bought || g.quantity || g.total_pax || g.pax || g.total_entries || 1;
                guestMap.set(uniqueId, g);
            }
        }

        const uniqueGuests = Array.from(guestMap.values());

        console.log(`Total unique guests fetched via tickets: ${uniqueGuests.length}`);
        if (uniqueGuests.length > 0) {
            console.log(`DEBUG: Aggregated Guest Sample: Name=${uniqueGuests[0].name}, TicketsBought=${uniqueGuests[0].tickets_bought}`);
        }

        // 3. Fallback: If ticket-based fetch yielded 0 guests, try the general list
        if (uniqueGuests.length === 0) {
            console.log("Ticket-based fetch returned 0 guests. Attempting fallback to general list...");
            try {
                const url = `/events/${eventId}/eventuser?type=all&per_page=5000`;
                const response = await client.get(url);
                const fallbackGuests = response.data?.data || response.data || [];

                if (Array.isArray(fallbackGuests) && fallbackGuests.length > 0) {
                    console.log(`Fallback successful. Found ${fallbackGuests.length} guests.`);
                    console.log("DEBUG: Full Fallback Guest Object:", JSON.stringify(fallbackGuests[0]));
                    return { guests_list: fallbackGuests };
                }
            } catch (fallbackErr) {
                console.log("Fallback fetch failed:", fallbackErr.message);
            }
        }

        if (uniqueGuests.length > 0) {
            console.log("DEBUG: Sample guest from bulk fetch:", JSON.stringify(uniqueGuests[0]));
        }

        return {
            guests_list: uniqueGuests
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

        // Format for API
        const payload = unsynced.map((p) => ({
            guest_id: p.guest_id,
            scanned_at: p.scanned_at,
            qr_code: p.qr_code,
            event_id: p.event_id || eventId
        }));

        const res = await syncOfflineCheckinsAPI(payload);

        if (res && (res.success || res.status === true || res.message === "Synced successfully")) {
            const qrCodes = unsynced.map(t => t.qr_code);
            await markTicketsAsSynced(qrCodes);
            return {
                success: true,
                count: unsynced.length,
                failed: 0,
                message: `Synced ${unsynced.length} guests successfully`
            };
        } else {
            return {
                success: false,
                count: 0,
                failed: unsynced.length,
                message: res?.message || "Bulk sync failed"
            };
        }

    } catch (error) {
        console.error("SYNC PENDING CHECKINS ERROR:", error);
        return { success: false, message: "Sync process failed" };
    }
};
