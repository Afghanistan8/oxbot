import Link from "next/link";
import { Flame, Handshake } from "lucide-react";

import { brand } from "@/lib/brand";
import { brandCollab } from "@/lib/brand-collab";
import { cn } from "@/lib/utils";

/**
 * Logo — the oxbot wordmark. A crimson flame glyph in a glowing rounded tile
 * beside the brand name rendered in the condensed display face.
 *
 * The name is pulled from `brand.ts` (or `brand-collab.ts` for the Collab
 * surface), so rebranding is a one-file change.
 */
export function Logo({
  className,
  href = "/",
  showText = true,
  size = "md",
  product = "oxbot",
}: {
  className?: string;
  href?: string | null;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  /** "collab" swaps the glyph + wordmark for OxFoxes Collab, same tile. */
  product?: "oxbot" | "collab";
}) {
  const dims = {
    sm: { box: "h-8 w-8", icon: "h-4 w-4", text: "text-lg" },
    md: { box: "h-10 w-10", icon: "h-5 w-5", text: "text-2xl" },
    lg: { box: "h-14 w-14", icon: "h-7 w-7", text: "text-4xl" },
  }[size];
  const isCollab = product === "collab";
  const Glyph = isCollab ? Handshake : Flame;
  const name = isCollab ? brandCollab.name : brand.name;

  const content = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative grid place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red transition-transform duration-300 group-hover:scale-105",
          dims.box
        )}
      >
        <Glyph className={cn("text-white drop-shadow", dims.icon)} strokeWidth={2.25} />
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
      </span>
      {showText &&
        (isCollab ? (
          <span className={cn("font-display font-bold tracking-tight text-white", dims.text)}>
            OxFoxes{" "}
            <span className="text-gradient-crimson">{brandCollab.short}</span>
          </span>
        ) : (
          <span
            className={cn(
              "font-display font-bold tracking-tight text-white",
              dims.text
            )}
          >
            {name}
          </span>
        ))}
    </span>
  );

  if (href === null) return content;

  return (
    <Link href={href} aria-label={name} className="inline-flex">
      {content}
    </Link>
  );
}
