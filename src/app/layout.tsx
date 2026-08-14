import type { Metadata, Viewport } from "next";
import { Inter, Archivo, JetBrains_Mono } from "next/font/google";

import { brand } from "@/lib/brand";
import { Providers } from "@/components/providers";
import { MockModeBanner } from "@/components/brand/mock-mode-banner";

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

export const metadata: Metadata = {
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
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — Web3 Giveaways & Raffles`,
    description: brand.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
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
        </Providers>
      </body>
    </html>
  );
}
