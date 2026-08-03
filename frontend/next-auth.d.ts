import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      role?: number;
      roles?: number[];
      status?: string;
      organization?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: number;
    roles?: number[];
    status?: string;
    organization?: string;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: number;
    roles?: number[];
    status?: string;
    accessToken?: string;
  }
}
