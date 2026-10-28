/**
 * Aurora Forensic Portal - Centralized API & Environment Configuration
 * Connects to local FastAPI backend on localhost:8000 during local development,
 * and seamlessly routes to Catalyst AppSail in production.
 */

const PROD_BACKEND_URL = "https://dip-backend-50047170003.development.catalystappsail.in";
const LOCAL_BACKEND_URL = "http://127.0.0.1:8000";

export const BACKEND_URL =
  typeof window !== "undefined"
    ? (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? (process.env.NEXT_PUBLIC_LOCAL_BACKEND_URL || LOCAL_BACKEND_URL)
        : (window.location.hostname.endsWith(".onslate.in") || window.location.hostname.endsWith(".onslate.com")
            ? ""
            : (process.env.NEXT_PUBLIC_BACKEND_URL || "")))
    : (process.env.NEXT_PUBLIC_BACKEND_URL ||
       (process.env.NODE_ENV === "development" ? LOCAL_BACKEND_URL : PROD_BACKEND_URL));

export const API_BASE_URL = BACKEND_URL;
