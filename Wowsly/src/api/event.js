import client from "./client";

// Simple in-memory cache
let eventsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getEvents = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && eventsCache && (now - lastFetchTime < CACHE_DURATION)) {
        console.log("Serving events from cache");
        return eventsCache;
    }

    try {
        const response = await client.get("/events");
        eventsCache = response.data;
        lastFetchTime = now;
        return response.data;
    } catch (error) {
        console.log(
            "EVENTS API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: [] };
    }
};

export const getEventDetails = async (id) => {
    try {
        const response = await client.get(`/events/${id}`);
        return response.data;
    } catch (error) {
        console.log(
            "EVENT DETAILS API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: null };
    }
};

export const getEventUsers = async (eventId, page = 1, type) => {
    try {
        const params = { page };
        if (type && type !== 'all') {
            params.type = type;
        }
        const response = await client.get(`/events/${eventId}/eventuser`, {
            params
        });
        return response.data;
    } catch (error) {
        console.log(
            "EVENT USERS API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: [] };
    }
};

export const getGuestDetails = async (eventId, guestId) => {
    try {
        console.log('getGuestDetails called with:', { eventId, guestId });
        // API expects event_user_id instead of guest_id
        const response = await client.get(`/events/${eventId}/eventuser/getguestdetails`, {
            params: { event_user_id: guestId }
        });
        console.log('getGuestDetails response:', response.data);
        return response.data;
    } catch (error) {
        console.log(
            "GUEST DETAILS API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: null };
    }
};

export const downloadOfflineData = async (eventId) => {
    try {
        console.log('Downloading offline data for event:', eventId);
        const response = await client.get(`/events/${eventId}/eventuser/fetch`);
        console.log('Offline data download response:', response.data);
        return response.data;
    } catch (error) {
        console.log(
            "OFFLINE DATA DOWNLOAD ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: null, error: error?.response?.data || error?.message };
    }
};

export const makeGuestManager = async (eventId, guestId) => {
    try {
        console.log('Making guest manager:', { eventId, guestId });
        const response = await client.put(`/events/${eventId}/eventuser/${guestId}`, {
            role: 'manager'
        });
        console.log('Make manager response:', response.data);
        return response.data;
    } catch (error) {
        console.log(
            "MAKE MANAGER API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: null };
    }
};

export const makeGuestUser = async (eventId, guestId, role = 'guest') => {
    try {
        console.log('Making guest user:', { eventId, guestId, role });
        const payload = { role: 'guest' };
        const response = await client.put(`/events/${eventId}/eventuser/${guestId}`, payload);
        console.log('Make guest response:', response.data);
        return response.data;
    } catch (error) {
        console.log(
            "MAKE GUEST API ERROR:",
            error?.response?.data || error?.message || error
        );
        return { status: false, data: null };
    }
};

