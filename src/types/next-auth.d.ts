import type { DefaultSession } from "next-auth";

/**
 * Augment the Auth.js session to include the user id (populated in the
 * `session` callback in lib/auth.ts).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
