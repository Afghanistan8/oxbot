import "server-only";

import { brandCollab } from "@/lib/brand-collab";
import { collabShareUrl } from "@/lib/collab/surface";
import { sendEmail } from "@/lib/integrations/email";
import { postCollabAnnouncement } from "@/lib/integrations/discord-webhook";
import { absoluteUrl } from "@/lib/utils";

/**
 * Best-effort Collab notifications. Never throws — a failed email or webhook
 * must not undo an approval that already committed.
 *
 *  - Email to the person who filed the request (mock mode prints to console).
 *  - The requester team's Discord webhook, when it has one, for approvals — a
 *    "WL collab secured" embed is exactly what communities want to announce.
 */

type Decision = "approved" | "rejected" | "needs_info" | "waitlisted" | "raffle_won";

export async function notifyRequestDecision(input: {
  decision: Decision;
  to: string | null;
  requesterTeam: { name: string; slug: string; discordWebhookUrl: string | null };
  listingTeam: { name: string };
  listing: { title: string; slug: string; bannerUrl: string | null };
  spotsGranted?: number | null;
  note?: string | null;
}): Promise<void> {
  const outgoingUrl = absoluteUrl(`/dashboard/${input.requesterTeam.slug}/collab/outgoing`);
  const listingUrl = collabShareUrl(`/listings/${input.listing.slug}`);
  const spots = input.spotsGranted ?? 0;

  const copy: Record<Decision, { subject: string; line: string }> = {
    approved: {
      subject: `${input.listingTeam.name} granted you ${spots} whitelist spot${spots === 1 ? "" : "s"}`,
      line: `${input.listingTeam.name} approved ${input.requesterTeam.name} for ${spots} spot${spots === 1 ? "" : "s"} on “${input.listing.title}”. Submit your delivery wallets to lock them in.`,
    },
    raffle_won: {
      subject: `You won ${spots} spot${spots === 1 ? "" : "s"} in the ${input.listingTeam.name} partner raffle`,
      line: `${input.requesterTeam.name} was drawn for ${spots} spot${spots === 1 ? "" : "s"} on “${input.listing.title}”. Submit your delivery wallets to lock them in.`,
    },
    rejected: {
      subject: `Update on your request to ${input.listingTeam.name}`,
      line: `${input.listingTeam.name} passed on this round for “${input.listing.title}”.`,
    },
    needs_info: {
      subject: `${input.listingTeam.name} needs more info on your whitelist request`,
      line: `${input.listingTeam.name} has a question about your request for “${input.listing.title}”. Reply from your desk.`,
    },
    waitlisted: {
      subject: `You're on the waitlist for ${input.listingTeam.name}`,
      line: `Your request for “${input.listing.title}” is waitlisted — you'll be first in line if spots free up.`,
    },
  };
  const { subject, line } = copy[input.decision];

  if (input.to) {
    try {
      await sendEmail({
        to: input.to,
        subject,
        html: emailTemplate(line, input.note ?? null, outgoingUrl),
        text: `${line}${input.note ? `\n\nNote: ${input.note}` : ""}\n\nOpen your desk: ${outgoingUrl}`,
      });
    } catch (e) {
      console.warn("[collab-notify] email failed:", e);
    }
  }

  if ((input.decision === "approved" || input.decision === "raffle_won") && input.requesterTeam.discordWebhookUrl) {
    const res = await postCollabAnnouncement(input.requesterTeam.discordWebhookUrl, {
      title: `WL collab secured: ${input.listingTeam.name}`,
      description: `${input.requesterTeam.name} secured ${spots} whitelist spot${spots === 1 ? "" : "s"} for “${input.listing.title}”.`,
      url: listingUrl,
      bannerUrl: input.listing.bannerUrl,
      footer: brandCollab.name,
    });
    if (!res.ok) console.warn("[collab-notify] webhook failed:", res.error);
  }
}

function emailTemplate(line: string, note: string | null, url: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `
  <div style="background:#080807;padding:40px 0;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#131210;border:1px solid #2A2722;border-radius:20px;padding:36px;color:#fff;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#F3D77A;">${esc(brandCollab.name)}</h1>
      <p style="color:#E8E2D0;font-size:14px;line-height:1.6;margin:0 0 16px;">${esc(line)}</p>
      ${note ? `<p style="color:#B7AD92;font-size:13px;line-height:1.6;margin:0 0 20px;border-left:2px solid #D8A72A;padding-left:12px;">${esc(note)}</p>` : ""}
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#D8A72A,#BA8B1F);color:#090506;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:600;font-size:14px;">Open your desk</a>
    </div>
  </div>`;
}
