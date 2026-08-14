import { anyMockActive, integrations } from "@/lib/env";

/**
 * A small fixed badge shown in development when one or more integrations are
 * running as mocks. Makes it obvious that CAPTCHA/email/X/Discord/uploads are
 * simulated. Hidden entirely in production or when everything is live.
 */
export function MockModeBanner() {
  if (process.env.NODE_ENV === "production") return null;
  if (!anyMockActive) return null;

  const mocked: string[] = [];
  if (!integrations.captcha.live) mocked.push("CAPTCHA");
  if (!integrations.email.live) mocked.push("Email");
  if (!integrations.twitter.oauthLive || !integrations.twitter.apiLive)
    mocked.push("X");
  if (!integrations.discord.oauthLive || !integrations.discord.botLive)
    mocked.push("Discord");
  if (!integrations.uploads.live) mocked.push("Uploads");

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-[60] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs text-amber-200 shadow-lg backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        <span className="font-medium">Dev mock mode</span>
        <span className="text-amber-200/70">{mocked.join(" · ")}</span>
      </div>
    </div>
  );
}
