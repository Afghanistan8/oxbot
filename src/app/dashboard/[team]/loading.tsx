import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant loading skeleton for the team dashboard content area. Covers the
 * overview page and every sub-section (giveaways, collab, analytics, members,
 * settings) via a single Suspense boundary, so clicks feel immediate while the
 * server renders the real page. The layout's sidebar + top bar are already on
 * screen — only this `<main>` content streams in.
 */
export default function TeamDashboardLoading() {
  return (
    <div>
      {/* Page header (title + description + action) */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
