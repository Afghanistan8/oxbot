import Link from "next/link";
import { Mail, Trophy, Crown, Globe, MessageCircle, CheckCircle2 } from "lucide-react";

import { requireUser } from "@/lib/session";
import {
  getSocialConnectionsForUser,
  connectionLabel,
  type SocialConnectionSummary,
} from "@/server/queries/teams";
import { getPrimaryWallet, getUserWins } from "@/server/queries/profile";
import { integrations } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { oauthSignInAction } from "@/server/actions/auth";
import { brand } from "@/lib/brand";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { WalletForm } from "@/components/profile/wallet-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

/**
 * /profile — the participant-facing account page: email, primary wallet,
 * connected X/Discord accounts, and win history. This is what powers entry
 * requirement verification everywhere else in the app.
 */
export default async function ProfilePage() {
  const user = await requireUser("/profile");

  const [wallet, connections, wins] = await Promise.all([
    getPrimaryWallet(user.id),
    getSocialConnectionsForUser(user.id),
    getUserWins(user.id),
  ]);
  const twitter = connections.find((c) => c.provider === "twitter") ?? null;
  const discord = connections.find((c) => c.provider === "discord") ?? null;

  return (
    <>
      <SiteHeader />
      <main className="container max-w-2xl py-12">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Your {brand.name} profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            These connections verify entry tasks across every giveaway.
          </p>
        </div>

        <div className="space-y-6">
          {/* Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-scarlet-soft" />
                Email
              </CardTitle>
              <CardDescription>Your sign-in method. Used to satisfy email requirements.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white">{user.email ?? "No email on file."}</p>
            </CardContent>
          </Card>

          {/* Wallet */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Crypto wallet
              </CardTitle>
              <CardDescription>
                Solana, Ethereum, Robinhood Chain, Arbitrum, and more. Used to satisfy
                wallet entry requirements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WalletForm wallet={wallet} />
            </CardContent>
          </Card>

          {/* X (Twitter) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-scarlet-soft" />
                X (Twitter) account
              </CardTitle>
              <CardDescription>
                Required to verify follow, like, and repost tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionRow
                connected={twitter}
                oauthLive={integrations.twitter.oauthLive}
                provider="twitter"
                label="Connect X"
              />
            </CardContent>
          </Card>

          {/* Discord */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-scarlet-soft" />
                Discord account
              </CardTitle>
              <CardDescription>
                Required to verify server membership and role-gated tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionRow
                connected={discord}
                oauthLive={integrations.discord.oauthLive}
                provider="discord"
                label="Connect Discord"
              />
            </CardContent>
          </Card>

          {/* Wins */}
          <Card id="wins">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-gold" />
                My wins
              </CardTitle>
              <CardDescription>Giveaways you&apos;ve won.</CardDescription>
            </CardHeader>
            <CardContent>
              {wins.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No wins yet — good luck on your next entry!
                </p>
              ) : (
                <ul className="space-y-2">
                  {wins.map((w) => (
                    <li key={w.giveawayId}>
                      <Link
                        href={`/giveaways/${w.giveawaySlug}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 transition-colors hover:border-gold/50"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                            {w.rank === 1 && <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />}
                            {w.giveawayTitle}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {w.teamName} · {w.prize}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(w.selectedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ConnectionRow({
  connected,
  oauthLive,
  provider,
  label,
}: {
  connected: SocialConnectionSummary | null;
  oauthLive: boolean;
  provider: "twitter" | "discord";
  label: string;
}) {
  if (connected) {
    const name = connectionLabel(connected);
    return (
      <div className="flex items-center gap-2.5">
        {connected.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={connected.avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full border border-border object-cover"
          />
        )}
        <div className="min-w-0">
          {name && (
            <p className="truncate text-sm font-medium text-white">{name}</p>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        </div>
      </div>
    );
  }
  if (!oauthLive) {
    return <p className="text-xs text-muted-foreground/80">Not configured in this environment yet.</p>;
  }
  return (
    <form action={oauthSignInAction}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="callbackUrl" value="/profile" />
      <Button type="submit" variant="outline" size="sm">
        {label}
      </Button>
    </form>
  );
}
