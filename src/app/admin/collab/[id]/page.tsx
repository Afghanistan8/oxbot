import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { getListingForAdmin } from "@/server/queries/collab";
import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { Button } from "@/components/ui/button";
import { AdminRequestForm } from "@/components/collab/admin-request-form";

export const metadata = { title: "Add Collab request" };
export const dynamic = "force-dynamic";

export default async function AdminAddRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/admin/collab/${id}`);
  if (!isPlatformAdminEmail(user.email)) redirect("/dashboard");

  const listing = await getListingForAdmin(id);
  if (!listing) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
          <Link href="/admin/collab">
            <ArrowLeft className="h-4 w-4" />
            All listings
          </Link>
        </Button>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">Add request</p>
        <h1 className="mb-8 mt-2 font-display text-3xl font-bold tracking-tight text-white">
          {listing.title} <span className="text-muted-foreground">· {listing.team.name}</span>
        </h1>

        <AdminRequestForm
          listingId={listing.id}
          listingTitle={listing.title}
          spotsPerRequestMin={listing.spotsPerRequestMin}
          spotsPerRequestMax={listing.spotsPerRequestMax}
          available={listing.available}
          backHref="/admin/collab"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
