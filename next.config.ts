import type { NextConfig } from "next";

/**
 * Hosts allowed to post Server Actions. Next.js rejects an action whose Origin
 * doesn't match the Host; OxFoxes Collab runs on its own subdomain (rewritten
 * into this app by src/middleware.ts), so both hosts are listed when set.
 */
function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const allowedActionOrigins = [
  process.env.COLLAB_HOST?.trim() || null,
  hostOf(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL),
].filter((h): h is string => Boolean(h));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Allow remote banners/logos from common hosts used for project art.
    // Uploads in dev are served locally from /public/uploads.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Server Actions are used heavily for the founder + entry flows.
    serverActions: {
      bodySizeLimit: "6mb",
      ...(allowedActionOrigins.length ? { allowedOrigins: allowedActionOrigins } : {}),
    },
  },
};

export default nextConfig;
