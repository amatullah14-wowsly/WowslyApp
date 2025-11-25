import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// -----------------------------------------------
// AXIOS INSTANCE
// -----------------------------------------------
const client = axios.create({
  baseURL: "https://backend.wowsly.com/api",  // correct base URL
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// -----------------------------------------------
// ADD TOKEN AUTOMATICALLY TO EVERY REQUEST
// -----------------------------------------------
client.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("auth_token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log("TOKEN ERROR:", error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default client;
