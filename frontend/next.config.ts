import type { NextConfig } from "next";

const IS_DEV = process.env.NODE_ENV !== "production";
const LOCAL_BACKEND_URL = "http://127.0.0.1:8000";
const PROD_BACKEND_URL = "https://dip-backend-50047170003.development.catalystappsail.in";

const DEFAULT_AUTH_URL = IS_DEV ? "http://localhost:3000" : "https://aurora.onslate.in";
const DEFAULT_BACKEND_URL = IS_DEV ? LOCAL_BACKEND_URL : PROD_BACKEND_URL;

const BACKEND_TARGET = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;

const nextConfig: NextConfig = {
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET || "fL6+4K+2d7bQ9a5N8wR1xZ4yU7jC3vM9pT5kH2eL8o=",
    AUTH_TRUST_HOST: "true",
    AUTH_URL: process.env.AUTH_URL || DEFAULT_AUTH_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || DEFAULT_AUTH_URL,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_BACKEND_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_TARGET}/api/v1/:path*`,
      },
      {
        source: "/api/admin/:path*",
        destination: `${BACKEND_TARGET}/api/admin/:path*`,
      },
      {
        source: "/api/user/:path*",
        destination: `${BACKEND_TARGET}/api/user/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_TARGET}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
