import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import Twitter from "next-auth/providers/twitter";
import Discord from "next-auth/providers/discord";
import type { Provider } from "next-auth/providers";

import { db } from "@/lib/db";
import { env, integrations } from "@/lib/env";
import { sendMagicLinkEmail } from "@/lib/integrations/email";

/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * - Email magic-link is always available. In mock mode the link prints to the
 *   server console (see lib/integrations/email.ts), so sign-in works with no SMTP.
 * - X (Twitter) and Discord OAuth are registered only when their keys are set;
 *   otherwise the buttons are hidden and social requirements use the mock connect
 *   flow in the entry system.
 *
 * Uses database sessions (required by the Email provider + Prisma adapter).
 */

/**
 * Auth.js's Nodemailer provider throws at construction if `server` is falsy
 * (see @auth/core/providers/nodemailer.js). We fully override
 * `sendVerificationRequest` to route through our own integration, which builds
 * its own transporter — so this value is never used to connect. It exists only
 * to satisfy the constructor guard. In live mode we still mirror the real SMTP
 * config so the provider stays correct if the override is ever removed; in mock
 * mode a placeholder URL string is enough (the `server` union accepts a string).
 */
function nodemailerServer(): string | Record<string, unknown> {
  if (!integrations.email.live) return "smtp://localhost:587";
  return {
    host: env.EMAIL_SERVER_HOST,
    port: Number(env.EMAIL_SERVER_PORT) || 587,
    auth:
      env.EMAIL_SERVER_USER || env.EMAIL_SERVER_PASSWORD
        ? { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD }
        : undefined,
  };
}

function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Nodemailer({
      server: nodemailerServer(),
      from: env.EMAIL_FROM,
      // Route through our integration so mock/live is decided in one place.
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail(identifier, url);
      },
    }),
  ];

  if (integrations.twitter.oauthLive) {
    providers.push(
      Twitter({
        clientId: env.AUTH_TWITTER_ID,
        clientSecret: env.AUTH_TWITTER_SECRET,
      })
    );
  }

  if (integrations.discord.oauthLive) {
    providers.push(
      Discord({
        clientId: env.AUTH_DISCORD_ID,
        clientSecret: env.AUTH_DISCORD_SECRET,
        authorization:
          "https://discord.com/api/oauth2/authorize?scope=identify+email+guilds+guilds.members.read",
      })
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  providers: buildProviders(),
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/verify",
    error: "/signin",
  },
  callbacks: {
    /**
     * Database session — attach the user id (and a couple of convenience fields)
     * to the session object consumed throughout the app.
     */
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    /**
     * Capture the provider's own profile (username/avatar) into
     * SocialConnection whenever an X or Discord account is linked, so the app
     * can show "connected as @handle" without re-querying the provider API.
     */
    async linkAccount({ user, account, profile }) {
      if (account.provider !== "twitter" && account.provider !== "discord") return;
      if (!user.id) return;

      let username: string | null = null;
      let displayName: string | null = null;
      let avatarUrl: string | null = null;

      if (account.provider === "twitter") {
        // OAuth 2.0 Twitter API v2 profile shape: { data: { id, username, name, profile_image_url } }
        const raw = profile as { data?: Record<string, unknown> } | undefined;
        const data = raw?.data ?? (profile as Record<string, unknown> | undefined) ?? {};
        username = typeof data.username === "string" ? data.username : null;
        displayName = typeof data.name === "string" ? data.name : null;
        avatarUrl = typeof data.profile_image_url === "string" ? data.profile_image_url : null;
      } else {
        const p = (profile as Record<string, unknown>) ?? {};
        username = typeof p.username === "string" ? p.username : null;
        displayName =
          typeof p.global_name === "string" ? p.global_name : (username ?? null);
        const discordId = typeof p.id === "string" ? p.id : null;
        const avatarHash = typeof p.avatar === "string" ? p.avatar : null;
        avatarUrl =
          discordId && avatarHash
            ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`
            : null;
      }

      await db.socialConnection.upsert({
        where: { userId_provider: { userId: user.id, provider: account.provider } },
        create: {
          userId: user.id,
          provider: account.provider,
          providerUserId: account.providerAccountId,
          username,
          displayName,
          avatarUrl,
        },
        update: { username, displayName, avatarUrl, providerUserId: account.providerAccountId },
      });
    },
  },
  // Trust the host in dev / behind a proxy.
  trustHost: true,
  secret: env.AUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
