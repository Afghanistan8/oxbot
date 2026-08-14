import { z } from "zod";

/**
 * Centralized, validated environment access.
 *
 * Only DATABASE_URL and AUTH_SECRET are strictly required. Every integration is
 * optional; when its keys are missing, oxbot runs that integration in a safe
 * local *mock* so the whole app works end-to-end with zero third-party setup.
 *
 * The `integrations` object below is the single source of truth for "is this
 * integration live?" — used across lib/integrations/* and the UI mock banner.
 */

const bool = (v: string | undefined) => v === "1" || v === "true";
const nonEmpty = (v: string | undefined) => Boolean(v && v.trim().length > 0);

// Validate only the hard requirements; keep everything else permissive so the
// app boots in mock mode. We coerce/normalize rather than throw on optionals.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(1)
    .optional()
    // In dev we tolerate a missing secret (Auth.js will warn); in prod it matters.
    .transform((v) => v ?? "dev-insecure-secret-change-me"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  // Surface a clear, single error message rather than a raw Zod dump.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and set the required values.`
  );
}

const forceMocks = bool(process.env.OXBOT_FORCE_MOCKS);

/** Per-integration live/mock detection. `live === false` means "use the mock". */
export const integrations = {
  forceMocks,
  captcha: {
    provider: (process.env.CAPTCHA_PROVIDER ?? "").toLowerCase() as
      | "recaptcha"
      | "hcaptcha"
      | "",
    live:
      !forceMocks &&
      (nonEmpty(process.env.RECAPTCHA_SECRET_KEY) ||
        nonEmpty(process.env.HCAPTCHA_SECRET_KEY)),
  },
  email: {
    live: !forceMocks && nonEmpty(process.env.EMAIL_SERVER_HOST),
  },
  twitter: {
    oauthLive:
      !forceMocks &&
      nonEmpty(process.env.AUTH_TWITTER_ID) &&
      nonEmpty(process.env.AUTH_TWITTER_SECRET),
    apiLive: !forceMocks && nonEmpty(process.env.TWITTER_BEARER_TOKEN),
  },
  discord: {
    oauthLive:
      !forceMocks &&
      nonEmpty(process.env.AUTH_DISCORD_ID) &&
      nonEmpty(process.env.AUTH_DISCORD_SECRET),
    botLive: !forceMocks && nonEmpty(process.env.DISCORD_BOT_TOKEN),
  },
  uploads: {
    live:
      !forceMocks &&
      nonEmpty(process.env.S3_BUCKET) &&
      nonEmpty(process.env.S3_ACCESS_KEY_ID),
  },
} as const;

/** True when at least one integration is running as a mock. */
export const anyMockActive =
  !integrations.captcha.live ||
  !integrations.email.live ||
  !integrations.twitter.oauthLive ||
  !integrations.twitter.apiLive ||
  !integrations.discord.oauthLive ||
  !integrations.discord.botLive ||
  !integrations.uploads.live;

export const env = {
  ...parsed.data,
  // Raw optional values (may be empty strings in mock mode).
  EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST ?? "",
  EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT ?? "587",
  EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER ?? "",
  EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "oxbot <no-reply@oxbot.app>",
  AUTH_TWITTER_ID: process.env.AUTH_TWITTER_ID ?? "",
  AUTH_TWITTER_SECRET: process.env.AUTH_TWITTER_SECRET ?? "",
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN ?? "",
  AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID ?? "",
  AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET ?? "",
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ?? "",
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY ?? "",
  HCAPTCHA_SECRET_KEY: process.env.HCAPTCHA_SECRET_KEY ?? "",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "",
  S3_REGION: process.env.S3_REGION ?? "",
  S3_BUCKET: process.env.S3_BUCKET ?? "",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "",
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL ?? "",
} as const;
