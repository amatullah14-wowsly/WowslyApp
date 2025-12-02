import client from "./client";

// Cache for events list
let eventsCache = {
    data: null,
    timestamp: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

        let allEvents = [];
        let page = 1;
        let hasMore = true;

        console.log("Fetching all events pages...");

        while (hasMore) {
            console.log(`Fetching events page ${page}...`);
            // Try to fetch more items per page to reduce requests
            const response = await client.get(`/events?page=${page}&per_page=100`);
            const data = response.data;

            if (data && data.data && Array.isArray(data.data)) {
                allEvents = [...allEvents, ...data.data];

                // Log pagination info if available
                if (data.total || data.last_page) {
                    console.log(`Pagination: Page ${data.current_page} of ${data.last_page}, Total: ${data.total}`);
                }

                // Check if we have reached the last page
                // Assuming the API returns meta information about pagination
                // If not, we might need to check if the data length is less than per_page
                // But for now, let's rely on the 'next_page_url' or similar if available, 
                // OR simply check if the returned data is empty.

                // Standard Laravel pagination often has links.next or meta.last_page
                // Let's check if the current page data count is 0, then stop.
                if (data.data.length === 0) {
                    hasMore = false;
                } else {
                    // Safety break to prevent infinite loops if API is weird
                    if (page > 200) {
                        console.log("Reached safety limit of 200 pages");
                        hasMore = false;
                    } else {
                        // Check if we got fewer items than expected (e.g. default per_page is usually 15 or 20)
                        // If we don't know the per_page, we can just try next page until empty.
                        // However, if the API returns the same data for page N and N+1 (buggy API), we loop.
                        // Let's assume standard behavior: keep going until empty array or last page.

                        // Better approach: check if response.data.next_page_url is null
                        if (data.next_page_url === null) {
                            hasMore = false;
                        } else {
                            page++;
                        }
                    }
                }
            } else {
                // Unexpected structure or empty
                hasMore = false;
            }
        }

        console.log(`Total events fetched: ${allEvents.length}`);

        // Update cache
        eventsCache = {
            data: { data: allEvents }, // Maintain structure expected by callers (res.data)
            timestamp: now,
        };

        return { data: allEvents };
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
                const soldUsers = soldRes?.data || soldRes || [];

                if (Array.isArray(soldUsers)) {
                    // Enrich users with ticket info if missing
                    const enrichedUsers = soldUsers.map(u => ({
                        ...u,
                        ticket_id: ticket.id,
                        ticket_title: ticket.title,
                        // Ensure tickets_bought is present if available in the user object
                        // or default to 1 if not found, but we hope getTicketSoldUsers returns it
                    }));
                    allGuests = [...allGuests, ...enrichedUsers];
                }
            } catch (err) {
                console.log(`Failed to fetch users for ticket ${ticket.id}:`, err.message);
            }
        }

        // Remove duplicates based on unique ID (id or uuid or qr_code)
        const uniqueGuests = [];
        const seenIds = new Set();

        for (const g of allGuests) {
            const uniqueId = g.qr_code || g.uuid || g.id;
            if (uniqueId && !seenIds.has(uniqueId)) {
                seenIds.add(uniqueId);
                uniqueGuests.push(g);
            }
        }

        console.log(`Total unique guests fetched: ${uniqueGuests.length}`);

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
