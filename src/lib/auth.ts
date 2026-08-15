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

/**
 * Best-effort lookup of the provider's true @handle, which the normalized
 * Auth.js profile doesn't expose (it only carries a display name).
 *
 * Deliberately non-fatal: any failure returns null and the UI falls back to the
 * display name. Sign-in must never break because a profile lookup hiccuped.
 * Runs once per account link, not per request.
 */
async function fetchProviderHandle(
  provider: "twitter" | "discord",
  accessToken: string | null | undefined
): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const url =
      provider === "discord"
        ? "https://discord.com/api/v10/users/@me"
        : "https://api.x.com/2/users/me";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    // Discord: { username, ... }   Twitter v2: { data: { username, ... } }
    const raw =
      provider === "discord"
        ? json
        : ((json.data as Record<string, unknown> | undefined) ?? {});
    return typeof raw.username === "string" ? raw.username : null;
  } catch (e) {
    console.warn(`[auth] ${provider} handle lookup failed:`, e);
    return null;
  }
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
     * Capture the linked X / Discord identity into SocialConnection so the app
     * can show "connected as …" without re-querying the provider on every render.
     */
    async linkAccount({ user, account, profile }) {
      if (account.provider !== "twitter" && account.provider !== "discord") return;
      if (!user.id) return;

      // IMPORTANT: Auth.js passes the provider's *normalized* profile here —
      // `{ id, name, email, image }` — not the raw OAuth payload. (`id` is a
      // freshly generated user id, NOT the provider's id, so the provider id
      // must come from `account.providerAccountId`.) Both the Discord and
      // Twitter providers collapse handle + display name into `name`, so the
      // true @handle is only available via a follow-up API call below.
      const p = (profile ?? {}) as { name?: unknown; image?: unknown };
      const displayName = typeof p.name === "string" ? p.name : null;
      const avatarUrl = typeof p.image === "string" ? p.image : null;
      const username = await fetchProviderHandle(account.provider, account.access_token);

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
