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
