import type { NextConfig } from "next";

const PROD_BACKEND_URL = "https://dip-backend-50047170003.development.catalystappsail.in";
const BACKEND_TARGET = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || PROD_BACKEND_URL;

const nextConfig: NextConfig = {
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET || "fL6+4K+2d7bQ9a5N8wR1xZ4yU7jC3vM9pT5kH2eL8o=",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://aurora.onslate.in",
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || PROD_BACKEND_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || PROD_BACKEND_URL,
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
