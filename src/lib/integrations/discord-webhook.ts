/**
 * Discord incoming-webhook announcements.
 *
 * Separate from the bot integration (lib/integrations/discord.ts) — a webhook
 * URL is enough to post a message to one channel, no bot invite or intents
 * needed. Founders create one from their server's Integrations settings.
 *
 * Best-effort: a failed post never blocks giveaway creation/publishing. If
 * Discord is down or the webhook was deleted, the giveaway still goes live —
 * it just doesn't get announced, which is logged, not thrown.
 */

const CRIMSON = 0xc41e3a;

export type AnnounceGiveaway = {
  title: string;
  prize: string;
  description: string | null;
  url: string;
  bannerUrl: string | null;
  chainLabel: string;
  typeLabel: string;
  startAt: Date;
  endAt: Date;
  isLive: boolean;
  /** FCFS has no end time — it closes when all slots are claimed. */
  isFcfs: boolean;
};

export async function postGiveawayAnnouncement(
  webhookUrl: string,
  teamName: string,
  giveaway: AnnounceGiveaway
): Promise<{ ok: boolean; error?: string }> {
  const status = giveaway.isLive ? "🎉 Live now" : "📅 Starting soon";
  const body = {
    embeds: [
      {
        title: giveaway.title,
        url: giveaway.url,
        description: giveaway.description
          ? giveaway.description.slice(0, 300)
          : undefined,
        color: CRIMSON,
        author: { name: teamName },
        image: giveaway.bannerUrl ? { url: giveaway.bannerUrl } : undefined,
        fields: [
          { name: "Prize", value: giveaway.prize.slice(0, 200), inline: false },
          { name: "Chain", value: giveaway.chainLabel, inline: true },
          { name: "Format", value: giveaway.typeLabel, inline: true },
          {
            name: giveaway.isFcfs ? "Closes" : "Ends",
            value: giveaway.isFcfs
              ? "When all spots are claimed"
              : `<t:${Math.floor(giveaway.endAt.getTime() / 1000)}:R>`,
            inline: true,
          },
        ],
        footer: { text: status },
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `Discord webhook returned ${res.status}.` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[discord-webhook] announcement failed:", e);
    return { ok: false, error: "Could not reach the Discord webhook." };
  }
}
