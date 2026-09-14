import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant loading skeleton for the top-level dashboard (all projects). Shown
 * while the server loads the viewer's teams, so the click feels immediate.
 */
export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}
