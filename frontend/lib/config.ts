/**
 * Aurora Forensic Portal - Centralized API & Environment Configuration
 * Ensures all API calls in production target the Catalyst AppSail backend.
 */

const PROD_BACKEND_URL = "https://dip-backend-50047170003.development.catalystappsail.in";

export const BACKEND_URL =
  typeof window !== "undefined"
    ? "" // Always use same-origin relative URLs in the browser so Next.js / Slate reverse-proxy rewrites handle routing and eliminate browser CORS preflights
    : (process.env.NEXT_PUBLIC_BACKEND_URL ||
       process.env.NEXT_PUBLIC_API_BASE_URL ||
       PROD_BACKEND_URL);

export const API_BASE_URL = BACKEND_URL;
