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
