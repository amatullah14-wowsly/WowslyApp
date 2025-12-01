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

        const response = await client.get("/events");

        // Update cache
        eventsCache = {
            data: response.data,
            timestamp: now,
        };

        return response.data;
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
        const response = await client.get(`/events/${eventId}/offline-download`);
        return response.data;
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
        const response = await client.get(`/events/${eventId}/ticket/${ticketId}/sold`, {
            params: {
                event_type: eventType,
                ticket_id: ticketId
            }
        });
        return response.data;
    } catch (error) {
        console.log("GET TICKET SOLD USERS ERROR:", error.response?.data || error.message);
        return { status: false, data: [] };
    }
};
