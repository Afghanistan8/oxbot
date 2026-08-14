import type { NextConfig } from "next";

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
    },
  },
};

export default nextConfig;
