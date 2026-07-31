import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        try {
          const res = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
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
              status: data.user.status,
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-ignore
        token.role = user.role;
        // @ts-ignore
        token.status = user.status;
        // @ts-ignore
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        // @ts-ignore - Adding custom fields to NextAuth Session
        session.user.role = token.role;
        // @ts-ignore
        session.user.status = token.status;
        // @ts-ignore
        session.accessToken = token.accessToken;
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
