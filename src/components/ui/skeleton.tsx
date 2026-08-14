import { cn } from "@/lib/utils";

/**
 * Skeleton — loading placeholder with a crimson shimmer (see `.shimmer` in globals.css).
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shimmer rounded-xl bg-muted/50",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
