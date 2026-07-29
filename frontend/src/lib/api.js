import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_API_URL;

export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});


// Attach JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // change this if your key is different

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");

  if (detail && typeof detail.msg === "string") return detail.msg;

  return String(detail);
}