import type { ContactMethod } from "@prisma/client";

/**
 * Community link + contact normalization for partner requests. Client-safe.
 *
 * Requesters can paste a full URL or just a handle; community links are stored
 * as https URLs on the platform's own domain, so reviewers only ever get links
 * to X / Discord / Telegram — never an arbitrary site.
 */

export type CommunityPlatform = "x" | "discord" | "telegram";

export const COMMUNITY_PLATFORMS: {
  key: CommunityPlatform;
  field: "communityX" | "communityDiscord" | "communityTelegram";
  label: string;
  placeholder: string;
  required: boolean;
}[] = [
  { key: "x", field: "communityX", label: "X", placeholder: "@community or x.com/community", required: true },
  { key: "discord", field: "communityDiscord", label: "Discord", placeholder: "discord.gg/invite", required: false },
  { key: "telegram", field: "communityTelegram", label: "Telegram", placeholder: "@group or t.me/group", required: false },
];

const HOSTS: Record<CommunityPlatform, string[]> = {
  x: ["x.com", "twitter.com"],
  discord: ["discord.gg", "discord.com", "discordapp.com"],
  telegram: ["t.me", "telegram.me"],
};

const HANDLE_URL: Partial<Record<CommunityPlatform, (h: string) => string>> = {
  x: (h) => `https://x.com/${h}`,
  telegram: (h) => `https://t.me/${h}`,
};

/**
 * Normalize a pasted link or handle. Returns `null` for blank input, the https
 * URL when valid, or `{ error }` when it doesn't belong to the platform.
 */
export function normalizeCommunityLink(
  platform: CommunityPlatform,
  raw: string | null | undefined
): string | null | { error: string } {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const handle = value.replace(/^@/, "");
  if (/^[A-Za-z0-9_.]{1,40}$/.test(handle) && !handle.includes("..") && HANDLE_URL[platform]) {
    // A bare word with a dot could be a domain ("t.me"), so only treat it as a
    // handle when it has no dot or starts with "@".
    if (!handle.includes(".") || value.startsWith("@")) return HANDLE_URL[platform]!(handle);
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const allowed = HOSTS[platform].some((h) => host === h || host.endsWith(`.${h}`));
    if (!allowed || url.pathname.length <= 1) throw new Error("bad host");
    url.protocol = "https:";
    return url.toString();
  } catch {
    const name = COMMUNITY_PLATFORMS.find((p) => p.key === platform)!.label;
    return {
      error:
        platform === "discord"
          ? "Paste a Discord invite link (discord.gg/…)."
          : `Enter ${/^[AEIOUX]/.test(name) ? "an" : "a"} ${name} handle or a ${HOSTS[platform][0]} link.`,
    };
  }
}

/** Strip a leading @ and whitespace from a handle (contact or community). */
export function cleanHandle(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^@/, "");
  return v ? v : null;
}

// --- Contact method (how a requester can be reached if approved) -----------

export const CONTACT_METHODS: { key: ContactMethod; label: string; placeholder: string; linkPrefix: string }[] = [
  { key: "X", label: "X (Twitter)", placeholder: "yourhandle", linkPrefix: "https://x.com/" },
  { key: "DISCORD", label: "Discord", placeholder: "username", linkPrefix: "" },
  { key: "TELEGRAM", label: "Telegram", placeholder: "yourhandle", linkPrefix: "https://t.me/" },
];

export function contactMethodMeta(method: ContactMethod) {
  return CONTACT_METHODS.find((m) => m.key === method) ?? CONTACT_METHODS[0]!;
}

/** A clickable link for a contact handle, or null when the method has none (Discord). */
export function contactLink(method: ContactMethod, handle: string): string | null {
  const prefix = contactMethodMeta(method).linkPrefix;
  return prefix ? `${prefix}${handle}` : null;
}
