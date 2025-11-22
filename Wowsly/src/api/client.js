import axios from "axios";

const client = axios.create({
  baseURL: "https://backend.wowsly.com/api",   // ✅ NO trailing slash
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export default client;
