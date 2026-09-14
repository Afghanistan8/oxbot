import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant loading skeleton for the public giveaway detail page. This route
 * renders its own header inside the page, so the skeleton stands in for the
 * whole view while the server loads the giveaway + the viewer's entry progress.
 */
export default function GiveawayDetailLoading() {
  return (
    <div className="min-h-screen">
      {/* Top bar spacer */}
      <div className="h-16 border-b border-border/60" />
      <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="space-y-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        {/* Entry sidebar */}
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
