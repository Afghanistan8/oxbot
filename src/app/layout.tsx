import type { Metadata, Viewport } from "next";
import { Inter, Archivo, JetBrains_Mono } from "next/font/google";

import { brand } from "@/lib/brand";
import { absoluteUrl } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { MockModeBanner } from "@/components/brand/mock-mode-banner";
import { WinNotifierGate } from "@/components/notifications/win-notifier-gate";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Slightly condensed, premium display face for titles.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Absolute so relative image paths in per-page OG overrides (e.g. a local-dev
// upload URL like "/uploads/banners/x.jpg") resolve correctly for link
// unfurlers — Discord, WhatsApp, X, etc. all require absolute image URLs.
const defaultOgImage = {
  url: absoluteUrl("/og-default.jpg"),
  width: 1200,
  height: 630,
  alt: `${brand.name} — Web3 Giveaways & Raffles`,
};

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: `${brand.name} — Web3 Giveaways & Raffles`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  keywords: [
    "web3 giveaway",
    "nft raffle",
    "crypto giveaway",
    "whitelist raffle",
    "allowlist",
    brand.name,
  ],
  openGraph: {
    title: `${brand.name} — Web3 Giveaways & Raffles`,
    description: brand.description,
    siteName: brand.name,
    type: "website",
    images: [defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — Web3 Giveaways & Raffles`,
    description: brand.description,
    images: [defaultOgImage.url],
  },
};

export const viewport: Viewport = {
  themeColor: "#080807",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${archivo.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Providers>
          {children}
          <MockModeBanner />
          <WinNotifierGate />
        </Providers>
      </body>
    </html>
  );
}
