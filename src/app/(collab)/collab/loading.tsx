import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant loading skeleton for the public Collab surface. Sits between the
 * layout's header and footer while the server loads live inventory, so
 * navigating into a listing feels immediate.
 */
export default function CollabLoading() {
  return (
    <div className="container py-10">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full" />
        ))}
      </div>
    </div>
  );
}
