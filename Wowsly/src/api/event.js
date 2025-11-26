import client from "./client";

export const getEvents = async () => {
    try {
        const response = await client.get("/events");
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
