import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { requireUser } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { getOpenListingsForAdmin } from "@/server/queries/collab";
import { formatNumber } from "@/lib/utils";
import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Platform admin · Collab" };
export const dynamic = "force-dynamic";

/**
 * /admin/collab — platform-admin tool for adding a Collab request on behalf
 * of a project that doesn't want to create an oxbot account. Gated on the
 * `PLATFORM_ADMIN_EMAILS` allowlist, not a Team role.
 */
export default async function AdminCollabPage() {
  const user = await requireUser("/admin/collab");
  if (!isPlatformAdminEmail(user.email)) redirect("/dashboard");

  const listings = await getOpenListingsForAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-crimson-gradient shadow-glow-red">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Collab platform admin</h1>
            <p className="text-sm text-muted-foreground">
              Add a whitelist request for a project that doesn&apos;t want an oxbot account.
            </p>
          </div>
        </div>

        {listings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
            No listings are currently open for requests.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <Link key={l.id} href={`/admin/collab/${l.id}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{l.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.team.name} · {formatNumber(l.available)} spots available
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
