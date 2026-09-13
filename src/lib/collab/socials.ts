/**
 * Community link normalization for partner requests. Client-safe.
 *
 * Requesters can paste a full URL or just a handle; everything is stored as an
 * https URL on the platform's own domain, so reviewers only ever get links to
 * X / Discord / Telegram / TikTok / Instagram — never an arbitrary site.
 */

export type CommunityPlatform = "x" | "discord" | "telegram" | "tiktok" | "instagram";

export const COMMUNITY_PLATFORMS: {
  key: CommunityPlatform;
  field: "communityX" | "communityDiscord" | "communityTelegram" | "communityTiktok" | "communityInstagram";
  label: string;
  placeholder: string;
}[] = [
  { key: "x", field: "communityX", label: "X", placeholder: "@community or x.com/community" },
  { key: "discord", field: "communityDiscord", label: "Discord", placeholder: "discord.gg/invite" },
  { key: "telegram", field: "communityTelegram", label: "Telegram", placeholder: "@group or t.me/group" },
  { key: "tiktok", field: "communityTiktok", label: "TikTok", placeholder: "@community or tiktok.com/@community" },
  { key: "instagram", field: "communityInstagram", label: "Instagram", placeholder: "@community or instagram.com/community" },
];

const HOSTS: Record<CommunityPlatform, string[]> = {
  x: ["x.com", "twitter.com"],
  discord: ["discord.gg", "discord.com", "discordapp.com"],
  telegram: ["t.me", "telegram.me"],
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
};

const HANDLE_URL: Partial<Record<CommunityPlatform, (h: string) => string>> = {
  x: (h) => `https://x.com/${h}`,
  telegram: (h) => `https://t.me/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
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

/** Strip a leading @ and whitespace from a contact handle. */
export function cleanHandle(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^@/, "");
  return v ? v : null;
}
