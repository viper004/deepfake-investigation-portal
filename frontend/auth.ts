import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { BACKEND_URL } from "@/lib/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fL6+4K+2d7bQ9a5N8wR1xZ4yU7jC3vM9pT5kH2eL8o=",
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        try {
          const backendUrl = BACKEND_URL;
          const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          
          const data = await res.json();
          
          if (res.ok && data.user) {
            return {
              id: data.user.id.toString(),
              email: data.user.email,
              name: data.user.full_name,
              role: data.user.role_id,
              roles: data.user.roles,
              status: data.user.status,
              image: data.user.profile_picture || null,
              profile_picture: data.user.profile_picture || null,
              accessToken: data.access_token
            };
          }
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login", // We can handle errors via search params on the login page
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // In development or when baseUrl is not configured locally, fallback to local origin
      let effectiveBase = baseUrl;
      if (
        (process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production") &&
        !baseUrl.includes("localhost") &&
        !baseUrl.includes("127.0.0.1")
      ) {
        effectiveBase = "http://localhost:3000";
      }

      if (url.startsWith("/")) {
        return `${effectiveBase}${url}`;
      }
      if (url.includes("dip-frontend-npczgoxg.onslate.in")) {
        return url.replace("https://dip-frontend-npczgoxg.onslate.in", "https://aurora.onslate.in");
      }
      try {
        const parsed = new URL(url);
        if (
          parsed.origin === effectiveBase ||
          parsed.origin === baseUrl ||
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname.endsWith(".onslate.in") ||
          parsed.hostname.endsWith(".onslate.com")
        ) {
          return url;
        }
      } catch {}
      return effectiveBase;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.roles = user.roles;
        token.status = user.status;
        token.picture = (user as any).profile_picture || user.image;
        token.profile_picture = (user as any).profile_picture || user.image;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as number | undefined;
        session.user.roles = token.roles as number[] | undefined;
        session.user.status = token.status as string | undefined;
        session.user.image = (token.picture || token.profile_picture) as string | undefined;
        (session.user as any).profile_picture = (token.profile_picture || token.picture) as string | undefined;
        session.accessToken = token.accessToken as string | undefined;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      
      // If trying to access dashboard or admin while not logged in, redirect to login
      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) return true;
        return false; 
      }
      
      return true;
    },
  },
});
